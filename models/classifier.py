import torch
import torch.nn as nn
import torchvision.models as models
from torchvision import transforms
import pickle
import numpy as np
import tensorflow as tf
from tensorflow import keras
from PIL import Image
import warnings

warnings.filterwarnings('ignore')


class PyTorchVegetableClassifier:
    """Классификатор овощей на PyTorch (EfficientNet)"""

    def __init__(self, model_path="models/vegetable_detector.pt",
                 class_names_path="models/class_names.pkl"):

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"⚙️ PyTorch модель загружается на: {self.device}")

        # Загружаем названия классов
        with open(class_names_path, 'rb') as f:
            self.class_names = pickle.load(f)

        # Создаем модель EfficientNet
        self.model = models.efficientnet_b0(pretrained=False)

        # Заменяем последний слой
        num_features = self.model.classifier[1].in_features
        self.model.classifier = nn.Sequential(
            nn.Dropout(p=0.3, inplace=True),
            nn.Linear(num_features, 512),
            nn.ReLU(),
            nn.BatchNorm1d(512),
            nn.Dropout(p=0.2),
            nn.Linear(512, len(self.class_names))
        )

        # Загружаем веса
        checkpoint = torch.load(model_path, map_location=self.device)

        # Проверяем формат checkpoint
        if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
            self.model.load_state_dict(checkpoint['model_state_dict'])
        elif isinstance(checkpoint, dict) and 'state_dict' in checkpoint:
            self.model.load_state_dict(checkpoint['state_dict'])
        else:
            # Предполагаем, что это уже state_dict
            try:
                self.model.load_state_dict(checkpoint)
            except:
                # Пробуем загрузить как полный checkpoint
                self.model.load_state_dict(checkpoint['models'])

        self.model.to(self.device)
        self.model.eval()

        # Трансформации для инференса
        self.transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])

        # Русские названия овощей
        self.russian_names = {
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

    def predict(self, image_pil):
        """Предсказание для PIL изображения"""
        try:
            # Преобразуем изображение
            image_tensor = self.transform(image_pil).unsqueeze(0).to(self.device)

            # Предсказание
            with torch.no_grad():
                outputs = self.model(image_tensor)
                probabilities = torch.nn.functional.softmax(outputs, dim=1)
                confidence, predicted_idx = torch.max(probabilities, 1)

                # Получаем топ-3 предсказания
                top3_probs, top3_idxs = torch.topk(probabilities, 3)

                confidence_value = confidence.item()
                class_idx = predicted_idx.item()

                # Основное предсказание
                if class_idx < len(self.class_names):
                    class_name = self.class_names[class_idx]
                    class_name_ru = self.russian_names.get(class_name, class_name)

                    result = {
                        'name': class_name,
                        'name_ru': class_name_ru,
                        'confidence': confidence_value,
                        'class_idx': class_idx
                    }
                else:
                    result = {
                        'name': 'Unknown',
                        'name_ru': 'Неизвестно',
                        'confidence': confidence_value,
                        'class_idx': class_idx
                    }

                # Топ-3 предсказания
                top_predictions = []
                for i in range(3):
                    idx = top3_idxs[0][i].item()
                    prob = top3_probs[0][i].item()

                    if idx < len(self.class_names):
                        class_name = self.class_names[idx]
                        class_name_ru = self.russian_names.get(class_name, class_name)

                        top_predictions.append({
                            'name': class_name,
                            'name_ru': class_name_ru,
                            'confidence': prob,
                            'rank': i + 1
                        })

                return {
                    'main_prediction': result,
                    'top_predictions': top_predictions,
                    'all_probabilities': probabilities.cpu().numpy()[0]
                }

        except Exception as e:
            print(f"Ошибка предсказания PyTorch: {e}")
            return None


class KerasVegetableClassifier:
    """Классификатор овощей на Keras/TensorFlow"""

    def __init__(self, model_path="models/vegetable_model.h5",
                 class_names_path="models/class_names.pkl"):

        print("⚙️ Keras модель загружается...")

        # Загружаем названия классов
        with open(class_names_path, 'rb') as f:
            self.class_names = pickle.load(f)

        # Загружаем модель Keras
        self.model = keras.models.load_model(model_path)

        # Трансформации для Keras
        self.img_size = (224, 224)  # Стандартный размер для моделей Keras

        # Русские названия овощей
        self.russian_names = {
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

    def predict(self, image_pil):
        """Предсказание для PIL изображения"""
        try:
            # Преобразуем изображение
            img = image_pil.resize(self.img_size)
            img_array = np.array(img) / 255.0

            # Добавляем batch dimension
            if len(img_array.shape) == 3:
                img_array = np.expand_dims(img_array, axis=0)

            # Предсказание
            predictions = self.model.predict(img_array, verbose=0)[0]

            # Получаем топ-3 предсказания
            top_indices = np.argsort(predictions)[-3:][::-1]

            # Основное предсказание
            main_idx = top_indices[0]
            confidence = predictions[main_idx]

            if main_idx < len(self.class_names):
                class_name = self.class_names[main_idx]
                class_name_ru = self.russian_names.get(class_name, class_name)

                result = {
                    'name': class_name,
                    'name_ru': class_name_ru,
                    'confidence': float(confidence),
                    'class_idx': int(main_idx)
                }
            else:
                result = {
                    'name': 'Unknown',
                    'name_ru': 'Неизвестно',
                    'confidence': float(confidence),
                    'class_idx': int(main_idx)
                }

            # Топ-3 предсказания
            top_predictions = []
            for i, idx in enumerate(top_indices):
                prob = predictions[idx]

                if idx < len(self.class_names):
                    class_name = self.class_names[idx]
                    class_name_ru = self.russian_names.get(class_name, class_name)

                    top_predictions.append({
                        'name': class_name,
                        'name_ru': class_name_ru,
                        'confidence': float(prob),
                        'rank': i + 1
                    })

            return {
                'main_prediction': result,
                'top_predictions': top_predictions,
                'all_probabilities': predictions.tolist()
            }

        except Exception as e:
            print(f"Ошибка предсказания Keras: {e}")
            return None


class VegetableClassifierEnsemble:
    """Ансамбль классификаторов для более точного предсказания"""

    def __init__(self):
        print("🚀 Инициализация ансамбля классификаторов...")

        # Пробуем загрузить обе модели
        self.pytorch_model = None
        self.keras_model = None

        try:
            self.pytorch_model = PyTorchVegetableClassifier()
            print("✅ PyTorch модель загружена")
        except Exception as e:
            print(f"⚠ Не удалось загрузить PyTorch модель: {e}")

        try:
            self.keras_model = KerasVegetableClassifier()
            print("✅ Keras модель загружена")
        except Exception as e:
            print(f"⚠ Не удалось загрузить Keras модель: {e}")

        if not self.pytorch_model and not self.keras_model:
            raise Exception("Не удалось загрузить ни одну модель!")

    def predict(self, image_pil):
        """Ансамблевое предсказание"""
        results = {}

        # Предсказание PyTorch моделью
        if self.pytorch_model:
            pytorch_result = self.pytorch_model.predict(image_pil)
            if pytorch_result:
                results['pytorch'] = pytorch_result

        # Предсказание Keras моделью
        if self.keras_model:
            keras_result = self.keras_model.predict(image_pil)
            if keras_result:
                results['keras'] = keras_result

        if not results:
            return None

        # Если есть предсказания от обеих моделей, усредняем их
        if 'pytorch' in results and 'keras' in results:
            pytorch_pred = results['pytorch']['main_prediction']
            keras_pred = results['keras']['main_prediction']

            # Если обе модели предсказывают один и тот же класс
            if pytorch_pred['name'] == keras_pred['name']:
                avg_confidence = (pytorch_pred['confidence'] + keras_pred['confidence']) / 2

                final_result = {
                    'main_prediction': {
                        'name': pytorch_pred['name'],
                        'name_ru': pytorch_pred['name_ru'],
                        'confidence': avg_confidence,
                        'class_idx': pytorch_pred['class_idx'],
                        'ensemble_confidence': 'high'
                    },
                    'top_predictions': results['pytorch']['top_predictions'],
                    'model_used': 'ensemble',
                    'individual_results': results
                }
            else:
                # Выбираем предсказание с большей уверенностью
                if pytorch_pred['confidence'] > keras_pred['confidence']:
                    final_result = {
                        'main_prediction': pytorch_pred,
                        'top_predictions': results['pytorch']['top_predictions'],
                        'model_used': 'pytorch',
                        'individual_results': results
                    }
                else:
                    final_result = {
                        'main_prediction': keras_pred,
                        'top_predictions': results['keras']['top_predictions'],
                        'model_used': 'keras',
                        'individual_results': results
                    }
        else:
            # Используем доступную модель
            model_type = 'pytorch' if 'pytorch' in results else 'keras'
            final_result = {
                'main_prediction': results[model_type]['main_prediction'],
                'top_predictions': results[model_type]['top_predictions'],
                'model_used': model_type,
                'individual_results': results
            }

        return final_result


# Синглтон экземпляр классификатора
_vegetable_classifier = None


def get_vegetable_classifier():
    """Получение экземпляра классификатора (ленивая загрузка)"""
    global _vegetable_classifier
    if _vegetable_classifier is None:
        _vegetable_classifier = VegetableClassifierEnsemble()
    return _vegetable_classifier