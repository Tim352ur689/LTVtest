import os
import cv2
import numpy as np
import base64
from flask import Flask, render_template, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from PIL import Image
import io
import time

# Импортируем наш классификатор
from models.classifier import get_vegetable_classifier

# Конфигурация Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = 'cookly-secret-key-2024'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB

# Разрешенные форматы изображений
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'jfif', 'webp', 'bmp', 'heic', 'heif'}

# Глобальный экземпляр классификатора
vegetable_classifier = None


def allowed_file(filename):
    """Проверка формата файла"""
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def init_classifier():
    """Инициализация классификатора при запуске"""
    global vegetable_classifier
    try:
        vegetable_classifier = get_vegetable_classifier()
        print("✅ Классификатор овощей инициализирован")
        return True
    except Exception as e:
        print(f"❌ Ошибка инициализации классификатора: {e}")
        return False


def create_annotated_image(image_array, prediction_result):
    """Создание аннотированного изображения с результатом"""
    try:
        annotated_img = image_array.copy()
        h, w = annotated_img.shape[:2]

        # Добавляем рамку
        border_color = (0, 255, 0)  # Зеленый
        cv2.rectangle(annotated_img, (10, 10), (w - 10, h - 10), border_color, 4)

        # Добавляем полупрозрачную панель для текста
        overlay = annotated_img.copy()
        cv2.rectangle(overlay, (0, 0), (w, 100), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.6, annotated_img, 0.4, 0, annotated_img)

        # Добавляем текст с предсказанием
        if prediction_result and 'main_prediction' in prediction_result:
            main_pred = prediction_result['main_prediction']

            # Определяем цвет текста в зависимости от уверенности
            if main_pred['confidence'] > 0.7:
                text_color = (0, 255, 0)  # Зеленый
                confidence_text = "ВЫСОКАЯ"
            elif main_pred['confidence'] > 0.4:
                text_color = (255, 255, 0)  # Желтый
                confidence_text = "СРЕДНЯЯ"
            else:
                text_color = (255, 100, 100)  # Красный
                confidence_text = "НИЗКАЯ"

            # Основной текст
            main_text = f"{main_pred['name_ru']} ({main_pred['name']})"
            cv2.putText(annotated_img, main_text, (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.2, text_color, 3)

            # Уверенность
            confidence_text = f"Уверенность: {main_pred['confidence'] * 100:.1f}% ({confidence_text})"
            cv2.putText(annotated_img, confidence_text, (20, 75),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

            # Добавляем иконку модели
            model_used = prediction_result.get('model_used', 'unknown')
            model_icon = "🤖" if model_used == 'ensemble' else "⚡" if model_used == 'pytorch' else "🧠"
            cv2.putText(annotated_img, model_icon, (w - 60, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 255, 255), 3)

        return cv2.cvtColor(annotated_img, cv2.COLOR_BGR2RGB)
    except Exception as e:
        print(f"Ошибка создания аннотированного изображения: {e}")
        return cv2.cvtColor(image_array, cv2.COLOR_BGR2RGB)


def format_alert_message(prediction_result, processing_time):
    """Форматирование сообщения для alert"""

    if not prediction_result or 'main_prediction' not in prediction_result:
        return "❌ НЕ УДАЛОСЬ ОБРАБОТАТЬ ИЗОБРАЖЕНИЕ\n\nПопробуйте другое фото или проверьте формат файла."

    main_pred = prediction_result['main_prediction']
    top_predictions = prediction_result.get('top_predictions', [])
    model_used = prediction_result.get('model_used', 'unknown')

    # Определяем эмодзи для модели
    model_emoji = {
        'ensemble': '🤖',
        'pytorch': '⚡',
        'keras': '🧠'
    }.get(model_used, '🔍')

    # Определяем статус уверенности
    if main_pred['confidence'] > 0.7:
        confidence_status = "✅ ВЫСОКАЯ УВЕРЕННОСТЬ"
        advice = "Можно смело использовать для поиска рецептов!"
    elif main_pred['confidence'] > 0.4:
        confidence_status = "⚠ СРЕДНЯЯ УВЕРЕННОСТЬ"
        advice = "Рекомендуется проверить альтернативные варианты."
    else:
        confidence_status = "❓ НИЗКАЯ УВЕРЕННОСТЬ"
        advice = "Попробуйте другое фото с более четким изображением."

    # Строим сообщение
    message_lines = [
        f"{model_emoji} COOKLY AI - РАСПОЗНАВАНИЕ ОВОЩЕЙ",
        "=" * 45,
        "",
        f"🏆 ОСНОВНОЕ ПРЕДСКАЗАНИЕ:",
        f"• {main_pred['name_ru']}",
        f"• ({main_pred['name']})",
        f"• Уверенность: {main_pred['confidence'] * 100:.1f}%",
        f"• {confidence_status}",
        "",
        f"📊 СТАТИСТИКА:",
        f"• Модель: {model_used.upper()}",
        f"• Время обработки: {processing_time:.1f} сек",
        f"• Всего классов: 15 овощей",
    ]

    # Добавляем альтернативные варианты
    if len(top_predictions) > 1:
        message_lines.extend(["", "🥈 АЛЬТЕРНАТИВНЫЕ ВАРИАНТЫ:"])

        for i, pred in enumerate(top_predictions[1:4], 2):  # Берем со 2-го места
            if pred['name'] != main_pred['name']:
                message_lines.append(
                    f"{i}. {pred['name_ru']} - {pred['confidence'] * 100:.1f}%"
                )

    # Добавляем советы
    message_lines.extend([
        "",
        "💡 СОВЕТЫ ПО ИСПОЛЬЗОВАНИЮ:",
        "1. Фокусируйтесь на одном овоще в кадре",
        "2. Используйте хорошее освещение",
        "3. Овощ должен занимать 70-80% фото",
        "4. Избегайте размытых изображений",
        "",
        "🎯 ДАЛЬНЕЙШИЕ ДЕЙСТВИЯ:",
        "• Нажмите OK чтобы увидеть фото с разметкой",
        "• Автоматически найдутся рецепты с этим овощем",
        "• Можно загрузить новое фото для анализа",
        "",
        f"{advice}",
        "=" * 45
    ])

    return "\n".join(message_lines)


@app.route('/')
def index():
    """Главная страница"""
    return render_template('index.html')


@app.route('/api/health')
def health_check():
    """Проверка здоровья API и модели"""
    try:
        if vegetable_classifier is None:
            return jsonify({
                'status': 'error',
                'message': 'Классификатор не инициализирован',
                'models_loaded': False
            })

        # Проверяем, какие модели загружены
        models_status = {
            'pytorch': vegetable_classifier.pytorch_model is not None,
            'keras': vegetable_classifier.keras_model is not None,
            'ensemble': True
        }

        return jsonify({
            'status': 'healthy',
            'message': 'API работает нормально',
            'models_loaded': models_status,
            'classifier_ready': True
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'models_loaded': False
        })


@app.route('/api/detect_vegetables', methods=['POST'])
def api_detect_vegetables():
    """API для распознавания овощей на фото"""
    start_time = time.time()

    if 'file' not in request.files:
        return jsonify({
            'success': False,
            'error': 'Файл не выбран',
            'processing_time': 0
        })

    file = request.files['file']

    if file.filename == '':
        return jsonify({
            'success': False,
            'error': 'Файл не выбран',
            'processing_time': 0
        })

    if not file or not allowed_file(file.filename):
        return jsonify({
            'success': False,
            'error': 'Недопустимый формат файла. Поддерживаются: JPG, PNG, BMP, WEBP, HEIC',
            'processing_time': 0
        })

    try:
        # Читаем файл в память
        file_data = file.read()

        # Проверяем размер файла (макс 16 МБ)
        if len(file_data) > 16 * 1024 * 1024:
            return jsonify({
                'success': False,
                'error': 'Файл слишком большой. Максимальный размер: 16 МБ',
                'processing_time': 0
            })

        # Конвертируем в numpy array
        nparr = np.frombuffer(file_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            # Пробуем открыть через PIL для HEIC/HEIF
            try:
                file.seek(0)  # Сбрасываем указатель файла
                pil_image = Image.open(io.BytesIO(file_data))
                img = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
            except:
                return jsonify({
                    'success': False,
                    'error': 'Не удалось прочитать изображение. Возможно, файл поврежден.',
                    'processing_time': 0
                })

        # Конвертируем в PIL Image для классификатора
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(img_rgb)

        # Проверяем, что классификатор загружен
        if vegetable_classifier is None:
            return jsonify({
                'success': False,
                'error': 'Модель распознавания не загружена',
                'processing_time': time.time() - start_time
            })

        # Распознаем овощи
        prediction_result = vegetable_classifier.predict(pil_image)

        # Создаем аннотированное изображение
        annotated_img = create_annotated_image(img, prediction_result)

        # Конвертируем результат в base64
        _, buffer = cv2.imencode('.jpg', cv2.cvtColor(annotated_img, cv2.COLOR_RGB2BGR))
        img_base64 = base64.b64encode(buffer).decode('utf-8')

        # Рассчитываем время обработки
        processing_time = time.time() - start_time

        # Форматируем сообщение для alert
        alert_message = format_alert_message(prediction_result, processing_time)

        # Подготавливаем ответ
        response_data = {
            'success': True,
            'alert_message': alert_message,
            'prediction': prediction_result,
            'image_base64': img_base64,
            'processing_time': processing_time,
            'detections_count': 1,  # Классификатор определяет один основной овощ
            'model_used': prediction_result.get('model_used', 'unknown') if prediction_result else 'none'
        }

        return jsonify(response_data)

    except Exception as e:
        print(f"Ошибка обработки изображения: {str(e)}")
        import traceback
        traceback.print_exc()

        return jsonify({
            'success': False,
            'error': f'Внутренняя ошибка сервера: {str(e)}',
            'processing_time': time.time() - start_time
        })


@app.route('/api/test_prediction', methods=['GET'])
def test_prediction():
    """Тестовый маршрут для проверки работы модели"""
    try:
        if vegetable_classifier is None:
            return jsonify({
                'success': False,
                'error': 'Классификатор не инициализирован'
            })

        # Создаем тестовое изображение (зеленый квадрат)
        test_img = np.zeros((224, 224, 3), dtype=np.uint8)
        test_img[50:150, 50:150] = [0, 255, 0]  # Зеленый квадрат

        pil_image = Image.fromarray(test_img)

        # Тестовое предсказание
        result = vegetable_classifier.predict(pil_image)

        return jsonify({
            'success': True,
            'message': 'Тестовое предсказание выполнено',
            'prediction': result,
            'models_loaded': {
                'pytorch': vegetable_classifier.pytorch_model is not None,
                'keras': vegetable_classifier.keras_model is not None
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })


# Статические файлы
@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)


if __name__ == '__main__':
    # Инициализируем классификатор при запуске
    print("🚀 Запуск Cookly с функцией распознавания овощей...")

    if init_classifier():
        print("✅ Все системы готовы к работе!")
        print("📱 Адрес: http://localhost:5000")
        print("🔍 API детекции: POST http://localhost:5000/api/detect_vegetables")
        print("🏥 Проверка здоровья: GET http://localhost:5000/api/health")
    else:
        print("⚠ Классификатор не загружен, но сервер запустится")
        print("⚠ Функция распознавания овощей будет недоступна")

    app.run(debug=True, host='0.0.0.0', port=5000)