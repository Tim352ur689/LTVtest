import torch
import torch.nn as nn
import torchvision.models as models
from torchvision import transforms
from PIL import Image
import numpy as np
import cv2
import base64
import io


class VegetableClassifier(nn.Module):
    def __init__(self, num_classes=15, pretrained=True):
        super(VegetableClassifier, self).__init__()

        # Используем EfficientNet как базовую модель
        self.model = models.efficientnet_b0(pretrained=pretrained)

        # Заменяем последний слой
        num_features = self.model.classifier[1].in_features
        self.model.classifier = nn.Sequential(
            nn.Dropout(p=0.3, inplace=True),
            nn.Linear(num_features, 512),
            nn.ReLU(),
            nn.BatchNorm1d(512),
            nn.Dropout(p=0.2),
            nn.Linear(512, num_classes)
        )

        # Преобразования для инференса
        self.val_transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])

    def forward(self, x):
        return self.model(x)

    def predict(self, image_tensor):
        """Предсказание для одного изображения"""
        self.eval()
        with torch.no_grad():
            output = self.forward(image_tensor.unsqueeze(0))
            probabilities = torch.nn.functional.softmax(output, dim=1)
            confidence, predicted = torch.max(probabilities, 1)
        return predicted.item(), confidence.item()


class VegetableDetector:
    def __init__(self, model_path="models/.pth"):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = self.load_model(model_path)

        # Классы вашего датасета
        self.classes = [
            'Bean', 'Bitter_Gourd', 'Bottle_Gourd', 'Brinjal', 'Broccoli',
            'Cabbage', 'Capsicum', 'Carrot', 'Cauliflower', 'Cucumber',
            'Papaya', 'Potato', 'Pumpkin', 'Radish', 'Tomato'
        ]

        # Русские названия
        self.classes_ru = {
            'Bean': 'Фасоль',
            'Bitter_Gourd': 'Горькая тыква',
            'Bottle_Gourd': 'Бутылочная тыква',
            'Brinjal': 'Баклажан',
            'Broccoli': 'Брокколи',
            'Cabbage': 'Капуста',
            'Capsicum': 'Болгарский перец',
            'Carrot': 'Морковь',
            'Cauliflower': 'Цветная капуста',
            'Cucumber': 'Огурец',
            'Papaya': 'Папайя',
            'Potato': 'Картофель',
            'Pumpkin': 'Тыква',
            'Radish': 'Редис',
            'Tomato': 'Помидор'
        }

        self.transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])

    def load_model(self, model_path):
        """Загрузка обученной модели"""
        try:
            model = VegetableClassifier(num_classes=15)
            model.load_state_dict(torch.load(model_path, map_location=self.device))
            model.to(self.device)
            model.eval()
            print(f"✅ Модель загружена на {self.device}")
            return model
        except Exception as e:
            print(f"❌ Ошибка загрузки модели: {e}")
            return None

    def detect_from_bytes(self, image_bytes):
        """Распознавание овоща из байтов изображения"""
        if self.model is None:
            return None, "Модель не загружена", 0.0

        try:
            # Конвертируем байты в PIL Image
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')

            # Применяем трансформации
            image_tensor = self.transform(image).unsqueeze(0).to(self.device)

            # Предсказание
            with torch.no_grad():
                output = self.model(image_tensor)
                probabilities = torch.nn.functional.softmax(output, dim=1)
                confidence, predicted_idx = torch.max(probabilities, 1)

                confidence_value = confidence.item()
                class_idx = predicted_idx.item()

                # Получаем топ-3 предсказания
                top3_probs, top3_idxs = torch.topk(probabilities, 3)
                top3_probs = top3_probs.cpu().numpy()[0]
                top3_idxs = top3_idxs.cpu().numpy()[0]

            # Формируем результат
            if class_idx < len(self.classes):
                class_name = self.classes[class_idx]
                class_name_ru = self.classes_ru.get(class_name, class_name)

                result = {
                    'main_class': class_name,
                    'main_class_ru': class_name_ru,
                    'confidence': confidence_value,
                    'top_predictions': []
                }

                # Добавляем топ-3 предсказания
                for i in range(len(top3_idxs)):
                    idx = top3_idxs[i]
                    if idx < len(self.classes):
                        class_name = self.classes[idx]
                        class_name_ru = self.classes_ru.get(class_name, class_name)

                        result['top_predictions'].append({
                            'class': class_name,
                            'class_ru': class_name_ru,
                            'confidence': top3_probs[i]
                        })

                # Создаем аннотированное изображение
                annotated_img = self.create_annotated_image(image_bytes, result)

                return result, "Успешно", annotated_img

            return None, "Класс не распознан", 0.0

        except Exception as e:
            print(f"❌ Ошибка распознавания: {e}")
            return None, str(e), 0.0

    def create_annotated_image(self, image_bytes, result):
        """Создаем изображение с результатом распознавания"""
        try:
            # Конвертируем байты в numpy array
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None:
                return None

            # Создаем копию для аннотации
            annotated = img.copy()
            h, w = annotated.shape[:2]

            # Добавляем рамку
            cv2.rectangle(annotated, (10, 10), (w - 10, h - 10), (0, 255, 0), 3)

            # Добавляем текст с результатом
            text = f"{result['main_class_ru']}: {result['confidence'] * 100:.1f}%"
            cv2.putText(annotated, text, (30, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 0), 3)

            # Конвертируем обратно в байты (base64)
            _, buffer = cv2.imencode('.jpg', annotated)
            return base64.b64encode(buffer).decode('utf-8')

        except Exception as e:
            print(f"❌ Ошибка создания аннотированного изображения: {e}")
            return None


# Глобальный экземпляр детектора
vegetable_detector = None


def get_detector():
    """Получение или создание детектора"""
    global vegetable_detector
    if vegetable_detector is None:
        vegetable_detector = VegetableDetector()
    return vegetable_detector