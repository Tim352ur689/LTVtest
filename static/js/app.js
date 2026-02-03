// Конфигурация
const API_BASE_URL = window.location.origin;
let currentTab = 'recipes';
let recipes = [];
let userRecipes = [];
let favorites = [];

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    loadRecipes();
    setupEventListeners();
    showTab('recipes');

    // Проверка поддержки камеры
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById('camera-button').style.display = 'none';
    }
});

// Загрузка рецептов
async function loadRecipes() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/recipes`);
        recipes = await response.json();
        displayRecipes(recipes, 'recipes-list');

        // Загрузка избранного
        const favResponse = await fetch(`${API_BASE_URL}/api/recipes/favorites`);
        favorites = await favResponse.json();
        displayRecipes(favorites, 'favorites-list');

        // Загрузка пользовательских рецептов
        const userResponse = await fetch(`${API_BASE_URL}/api/recipes/user`);
        userRecipes = await userResponse.json();
        displayRecipes(userRecipes, 'my-recipes-list');

        // Показать/скрыть сообщения о пустых списках
        updateEmptyStates();

    } catch (error) {
        console.error('Ошибка загрузки рецептов:', error);
        showNotification('Ошибка загрузки рецептов', 'error');
    }
}

// Отображение рецептов
function displayRecipes(recipesArray, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (recipesArray.length === 0) {
        return;
    }

    recipesArray.forEach(recipe => {
        const recipeCard = createRecipeCard(recipe);
        container.appendChild(recipeCard);
    });
}

// Создание карточки рецепта
function createRecipeCard(recipe) {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.dataset.id = recipe.id;

    const isFavorite = recipe.isFavorite || false;
    const favoriteIcon = isFavorite ? 'fas fa-heart' : 'far fa-heart';

    card.innerHTML = `
        <div class="recipe-image" style="background-image: url('${recipe.image}')">
            <button class="favorite-btn" onclick="toggleFavorite(${recipe.id}, event)">
                <i class="${favoriteIcon}"></i>
            </button>
            <div class="recipe-time">${recipe.time}</div>
        </div>
        <div class="recipe-info">
            <h3 class="recipe-title">${recipe.title}</h3>
            <div class="recipe-meta">
                <span class="recipe-difficulty ${recipe.difficulty.toLowerCase()}">
                    <i class="fas fa-signal"></i> ${recipe.difficulty}
                </span>
                <span class="recipe-calories">
                    <i class="fas fa-fire"></i> ${recipe.calories}
                </span>
                <span class="recipe-servings">
                    <i class="fas fa-user-friends"></i> ${recipe.servings}
                </span>
            </div>
            <div class="recipe-products">
                ${(recipe.detected_products || []).map(product => `
                    <span class="product-tag">${getProductEmoji(product)} ${getProductName(product)}</span>
                `).join('')}
            </div>
        </div>
    `;

    card.addEventListener('click', () => showRecipeDetails(recipe.id));
    return card;
}

// Получение эмодзи продукта
function getProductEmoji(productName) {
    const emojiMap = {
        'Tomato': '🍅',
        'Cucumber': '🥒',
        'Carrot': '🥕',
        'Potato': '🥔',
        'Capsicum': '🫑',
        'Cabbage': '🥬',
        'Broccoli': '🥦',
        'Brinjal': '🍆',
        'Bean': '🫛',
        'Radish': '🌶️',
        'Pumpkin': '🎃',
        'Cauliflower': '🍄'
    };
    return emojiMap[productName] || '🥗';
}

// Получение русского названия продукта
function getProductName(productName) {
    const nameMap = {
        'Tomato': 'Помидор',
        'Cucumber': 'Огурец',
        'Carrot': 'Морковь',
        'Potato': 'Картофель',
        'Capsicum': 'Перец',
        'Cabbage': 'Капуста',
        'Broccoli': 'Брокколи',
        'Brinjal': 'Баклажан',
        'Bean': 'Фасоль',
        'Radish': 'Редис',
        'Pumpkin': 'Тыква',
        'Cauliflower': 'Цветная капуста'
    };
    return nameMap[productName] || productName;
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Навигация
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            showTab(tabName);
        });
    });

    // Кнопка создания рецепта
    document.getElementById('add-recipe-btn').addEventListener('click', () => {
        showTab('create');
    });

    // Загрузка фото
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const cameraButton = document.getElementById('camera-button');

    if (uploadArea) {
        uploadArea.addEventListener('click', () => fileInput.click());

        // Drag & Drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.backgroundColor = '';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.backgroundColor = '';

            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                analyzePhoto(fileInput.files[0]);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                analyzePhoto(e.target.files[0]);
            }
        });
    }

    if (cameraButton) {
        cameraButton.addEventListener('click', openCamera);
    }

    // Форма создания рецепта
    const recipeForm = document.getElementById('recipe-form');
    if (recipeForm) {
        recipeForm.addEventListener('submit', saveRecipe);
    }
}

// Показать вкладку
function showTab(tabName) {
    currentTab = tabName;

    // Обновить навигацию
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Показать содержимое вкладки
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabName);
    });

    // Скрыть кнопку добавления на вкладке создания
    const addButton = document.getElementById('add-recipe-btn');
    if (addButton) {
        addButton.style.display = tabName === 'create' ? 'none' : 'flex';
    }

    // Обновить пустые состояния
    updateEmptyStates();

    // Прокрутить наверх
    window.scrollTo(0, 0);
}

// Обновить состояния пустых списков
function updateEmptyStates() {
    const emptyFavorites = document.getElementById('empty-favorites');
    const emptyMyRecipes = document.getElementById('empty-my-recipes');

    if (emptyFavorites) {
        emptyFavorites.style.display = favorites.length === 0 ? 'block' : 'none';
    }

    if (emptyMyRecipes) {
        emptyMyRecipes.style.display = userRecipes.length === 0 ? 'block' : 'none';
    }
}

// Анализ фото продуктов
async function analyzePhoto(file) {
    if (!file) return;

    // Показать индикатор загрузки
    showLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE_URL}/api/analyze-photo`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            // Показать alert с результатами
            alert(result.alert_message);

            // После закрытия alert показать подобранные рецепты
            showSearchResults(result.products);

            // Показать вкладку поиска
            showTab('search');

        } else {
            alert(`❌ Ошибка анализа фото:\n\n${result.error}`);
        }

    } catch (error) {
        console.error('Ошибка анализа фото:', error);
        alert('❌ Ошибка соединения с сервером');
    } finally {
        showLoading(false);
    }
}

// Показать результаты поиска
async function showSearchResults(products) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/recipes-by-products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ products: products })
        });

        const matchingRecipes = await response.json();
        const container = document.getElementById('search-recipes');

        if (container) {
            if (matchingRecipes.length > 0) {
                displayRecipes(matchingRecipes, 'search-recipes');
            } else {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px;">
                        <div style="font-size: 4rem; color: #FF9800; margin-bottom: 20px;">
                            <i class="fas fa-search"></i>
                        </div>
                        <h3 style="color: #666; margin-bottom: 15px;">Рецепты не найдены</h3>
                        <p style="color: #888;">Попробуйте другое фото или создайте свой рецепт</p>
                    </div>
                `;
            }
        }

    } catch (error) {
        console.error('Ошибка поиска рецептов:', error);
    }
}

// Открыть камеру
async function openCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });

        // Создать модальное окно для камеры
        const cameraModal = document.createElement('div');
        cameraModal.className = 'camera-modal';
        cameraModal.innerHTML = `
            <div class="camera-content">
                <video id="camera-stream" autoplay playsinline></video>
                <div class="camera-controls">
                    <button class="capture-btn" onclick="capturePhoto()">
                        <i class="fas fa-camera"></i>
                    </button>
                    <button class="close-camera-btn" onclick="closeCamera()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(cameraModal);

        const video = document.getElementById('camera-stream');
        video.srcObject = stream;

    } catch (error) {
        console.error('Ошибка доступа к камере:', error);
        alert('Не удалось получить доступ к камере');
    }
}

// Сделать фото с камеры
function capturePhoto() {
    const video = document.getElementById('camera-stream');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Преобразовать в blob
    canvas.toBlob(blob => {
        const file = new File([blob], 'camera_photo.jpg', { type: 'image/jpeg' });
        closeCamera();
        analyzePhoto(file);
    }, 'image/jpeg', 0.9);
}

// Закрыть камеру
function closeCamera() {
    const cameraModal = document.querySelector('.camera-modal');
    if (cameraModal) {
        const video = document.getElementById('camera-stream');
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }
        cameraModal.remove();
    }
}

// Добавить/удалить из избранного
async function toggleFavorite(recipeId, event) {
    if (event) event.stopPropagation();

    try {
        const response = await fetch(`${API_BASE_URL}/api/recipes/${recipeId}/favorite`, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            // Обновить данные
            await loadRecipes();

            // Показать уведомление
            const message = result.isFavorite ?
                'Добавлено в избранное' : 'Удалено из избранного';
            showNotification(message, 'success');
        }

    } catch (error) {
        console.error('Ошибка обновления избранного:', error);
        showNotification('Ошибка обновления', 'error');
    }
}

// Показать детали рецепта
function showRecipeDetails(recipeId) {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const modal = document.getElementById('recipe-modal');
    const content = modal.querySelector('.modal-content');

    content.innerHTML = `
        <div class="modal-recipe">
            <button class="modal-close" onclick="closeModal()">
                <i class="fas fa-times"></i>
            </button>
            <div class="modal-recipe-image" style="background-image: url('${recipe.image}')"></div>
            <div class="modal-recipe-content">
                <h2 class="modal-recipe-title">${recipe.title}</h2>

                <div class="modal-recipe-meta">
                    <div class="meta-item">
                        <i class="fas fa-clock"></i>
                        <span>${recipe.time}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-signal"></i>
                        <span>${recipe.difficulty}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-fire"></i>
                        <span>${recipe.calories}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-user-friends"></i>
                        <span>${recipe.servings}</span>
                    </div>
                </div>

                <div class="modal-section">
                    <h3><i class="fas fa-shopping-basket"></i> Ингредиенты</h3>
                    <ul class="ingredients-list">
                        ${recipe.ingredients.map(ing => `<li>${ing}</li>`).join('')}
                    </ul>
                </div>

                <div class="modal-section">
                    <h3><i class="fas fa-list-ol"></i> Шаги приготовления</h3>
                    <ol class="steps-list">
                        ${recipe.steps.map((step, i) => `<li>${step}</li>`).join('')}
                    </ol>
                </div>

                <div class="modal-actions">
                    <button class="modal-favorite-btn" onclick="toggleFavorite(${recipe.id})">
                        <i class="${recipe.isFavorite ? 'fas' : 'far'} fa-heart"></i>
                        ${recipe.isFavorite ? 'В избранном' : 'В избранное'}
                    </button>
                    <button class="modal-close-btn" onclick="closeModal()">
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// Закрыть модальное окно
function closeModal() {
    const modal = document.getElementById('recipe-modal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Показать индикатор загрузки
function showLoading(show) {
    let loading = document.getElementById('loading-overlay');

    if (!loading && show) {
        loading = document.createElement('div');
        loading.id = 'loading-overlay';
        loading.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-utensils fa-spin"></i>
                <p>Анализируем фото...</p>
            </div>
        `;
        document.body.appendChild(loading);
    }

    if (loading) {
        loading.style.display = show ? 'flex' : 'none';
    }
}

// Показать уведомление
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(notification);

    // Анимация появления
    setTimeout(() => notification.classList.add('show'), 10);

    // Автоматическое скрытие
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Добавить ингредиент
function addIngredient() {
    const container = document.getElementById('ingredients-container');
    const noIngredients = document.getElementById('no-ingredients-message');

    if (noIngredients) noIngredients.style.display = 'none';

    const ingredientDiv = document.createElement('div');
    ingredientDiv.className = 'ingredient-item';
    ingredientDiv.innerHTML = `
        <input type="text" class="ingredient-input" placeholder="Например: Помидоры - 2 шт">
        <button type="button" class="remove-ingredient-btn" onclick="this.parentElement.remove(); checkEmptyIngredients()">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(ingredientDiv);
}

// Проверить пустые ингредиенты
function checkEmptyIngredients() {
    const container = document.getElementById('ingredients-container');
    const noIngredients = document.getElementById('no-ingredients-message');

    if (noIngredients && container.children.length === 0) {
        noIngredients.style.display = 'block';
    }
}

// Добавить шаг приготовления
function addStep() {
    const container = document.getElementById('steps-container');
    const stepDiv = document.createElement('div');
    stepDiv.className = 'step-item';
    stepDiv.innerHTML = `
        <textarea class="step-input" placeholder="Опишите шаг приготовления"></textarea>
        <button type="button" class="remove-step-btn" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(stepDiv);
}

// Сохранить рецепт
async function saveRecipe(e) {
    e.preventDefault();

    // Собрать данные
    const ingredients = Array.from(document.querySelectorAll('.ingredient-input'))
        .map(input => input.value.trim())
        .filter(value => value);

    const steps = Array.from(document.querySelectorAll('.step-input'))
        .map(textarea => textarea.value.trim())
        .filter(value => value);

    const recipeData = {
        title: document.getElementById('recipe-title').value,
        image: document.getElementById('recipe-image').value || 'https://images.unsplash.com/photo-1546069901-d5bfd2cbfb1f?w=400',
        time: document.getElementById('recipe-time').value,
        difficulty: document.getElementById('recipe-difficulty').value,
        calories: document.getElementById('recipe-calories').value,
        servings: document.getElementById('recipe-servings').value,
        ingredients: ingredients,
        steps: steps
    };

    // Проверка обязательных полей
    if (!recipeData.title || !recipeData.time || !recipeData.difficulty ||
        !recipeData.calories || !recipeData.servings) {
        showNotification('Заполните все обязательные поля', 'error');
        return;
    }

    if (ingredients.length === 0) {
        showNotification('Добавьте хотя бы один ингредиент', 'error');
        return;
    }

    if (steps.length === 0) {
        showNotification('Добавьте хотя бы один шаг приготовления', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/recipes/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(recipeData)
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Рецепт успешно создан!', 'success');
            resetForm();
            await loadRecipes();
            showTab('my-recipes');
        } else {
            showNotification(`Ошибка: ${result.error}`, 'error');
        }

    } catch (error) {
        console.error('Ошибка создания рецепта:', error);
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Сбросить форму
function resetForm() {
    document.getElementById('recipe-form').reset();
    document.getElementById('ingredients-container').innerHTML = '';
    document.getElementById('steps-container').innerHTML = '';

    const noIngredients = document.getElementById('no-ingredients-message');
    if (noIngredients) noIngredients.style.display = 'block';
}

// Отменить создание рецепта
function cancelCreate() {
    if (confirm('Отменить создание рецепта? Все несохраненные данные будут потеряны.')) {
        resetForm();
        showTab('recipes');
    }
}

// ================== ОСНОВНОЙ КОД COOKLY (существующий) ==================

// [Весь существующий код Cookly остается без изменений]
// ...

// ================== ДОПОЛНИТЕЛЬНЫЙ КОД ДЛЯ РАСПОЗНАВАНИЯ ОВОЩЕЙ ==================

// Инициализация функционала поиска по фото при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Существующий код инициализации Cookly...

    // Дополнительно: инициализируем функционал поиска по фото
    initPhotoSearch();
});

function initPhotoSearch() {
    const uploadArea = document.getElementById('upload-area');
    const cameraButton = document.getElementById('camera-button');
    const fileInput = document.getElementById('file-input');

    // Если элементов нет на странице (не в нужной вкладке), выходим
    if (!uploadArea || !cameraButton || !fileInput) return;

    // Обработка drag & drop для области загрузки
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
        this.style.borderColor = 'var(--primary-green)';
    });

    uploadArea.addEventListener('dragleave', function() {
        this.style.backgroundColor = '';
        this.style.borderColor = '';
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        this.style.backgroundColor = '';
        this.style.borderColor = '';

        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handlePhotoUpload(fileInput.files[0]);
        }
    });

    // Клик по области загрузки
    uploadArea.addEventListener('click', function() {
        fileInput.click();
    });

    // Выбор файла через input
    fileInput.addEventListener('change', function() {
        if (this.files.length) {
            handlePhotoUpload(this.files[0]);
        }
    });

    // Кнопка камеры (заглушка)
    cameraButton.addEventListener('click', function() {
        alert('📸 Функция камеры будет доступна в следующем обновлении!\nПока что используйте загрузку файлов.');
    });
}

function handlePhotoUpload(file) {
    if (!file) return;

    // Проверка типа файла
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/heic', 'image/heif'];
    if (!validTypes.includes(file.type)) {
        showPhotoUploadError('Неподдерживаемый формат', 'Пожалуйста, выберите файл формата JPG, PNG, GIF, BMP, HEIC или HEIF.');
        return;
    }

    // Проверка размера (10 МБ)
    if (file.size > 10 * 1024 * 1024) {
        showPhotoUploadError('Файл слишком большой', 'Максимальный размер файла: 10 МБ.');
        return;
    }

    // Показываем индикатор загрузки
    showPhotoLoading(true);

    // Отправляем файл на сервер
    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/detect_vegetables', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Ошибка сервера: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        showPhotoLoading(false);

        if (data.success) {
            // Показываем alert с результатами
            showVegetableDetectionResults(data);



            // Показываем рецепты на основе найденного овоща
            if (data.detections && data.detections.length > 0) {
                setTimeout(() => {
                    showRecipesForDetectedVegetable(data.detections[0]);
                }, 500);
            }
        } else {
            showPhotoUploadError('Ошибка обработки', data.error || 'Неизвестная ошибка');
        }
    })
    .catch(error => {
        showPhotoLoading(false);
        showPhotoUploadError('Ошибка сети', error.message);
    });
}

function showVegetableDetectionResults(data) {
    // Показываем alert с результатами распознавания
    alert(data.alert_message);

    // Добавляем уведомление в интерфейс
    const searchSection = document.querySelector('.photo-search-container');
    if (searchSection && data.detections && data.detections.length > 0) {
        const mainDetection = data.detections[0];

        // Создаем уведомление о результате
        const notification = document.createElement('div');
        notification.className = 'vegetable-detection-notification';
        notification.style.cssText = `
            background: var(--light-green);
            padding: 20px;
            border-radius: 15px;
            margin: 25px 0;
            border-left: 6px solid var(--primary-green);
            animation: fadeIn 0.5s ease-out;
        `;

        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                <div style="width: 50px; height: 50px; background: var(--primary-green); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem;">
                    ${getVegetableEmoji(mainDetection.name)}
                </div>
                <div>
                    <h4 style="margin: 0; color: var(--dark-green); font-size: 1.3rem;">Овощ распознан!</h4>
                    <p style="margin: 5px 0 0 0; color: var(--text-light); font-size: 0.9rem;">
                        ИИ определил овощ на фото
                    </p>
                </div>
            </div>

            <div style="background: white; padding: 15px; border-radius: 10px; margin-top: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                        <h5 style="margin: 0; color: var(--dark-green); font-size: 1.1rem;">
                            ${mainDetection.name_ru || mainDetection.name}
                        </h5>
                        ${mainDetection.name !== mainDetection.name_ru ? `
                            <p style="margin: 5px 0 0 0; color: var(--text-light); font-size: 0.85rem;">
                                ${mainDetection.name}
                            </p>
                        ` : ''}
                    </div>
                    <div style="background: ${getConfidenceColor(mainDetection.confidence)};
                                color: ${getConfidenceTextColor(mainDetection.confidence)};
                                padding: 8px 15px; border-radius: 20px; font-weight: bold; font-size: 0.9rem;">
                        ${(mainDetection.confidence * 100).toFixed(1)}% уверенность
                    </div>
                </div>

                ${data.detections.length > 1 ? `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
                    <p style="margin: 0 0 10px 0; color: var(--text-light); font-size: 0.9rem;">
                        <i class="fas fa-lightbulb" style="color: var(--accent-teal); margin-right: 5px;"></i>
                        Также возможно:
                    </p>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                        ${data.detections.slice(1, 4).map(det => `
                            <span style="background: #f8f9fa; padding: 5px 12px; border-radius: 15px; font-size: 0.85rem; color: var(--text-light); border: 1px solid #dee2e6;">
                                ${det.name_ru || det.name} (${(det.confidence * 100).toFixed(0)}%)
                            </span>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        // Вставляем уведомление перед результатами поиска
        const resultsSection = document.getElementById('search-results');
        if (resultsSection) {
            // Удаляем старое уведомление, если есть
            const oldNotification = searchSection.querySelector('.vegetable-detection-notification');
            if (oldNotification) {
                oldNotification.remove();
            }

            searchSection.insertBefore(notification, resultsSection);
        }
    }
}

function showRecipesForDetectedVegetable(detection) {
    const resultsSection = document.getElementById('search-results');
    const searchRecipes = document.getElementById('search-recipes');

    if (!resultsSection || !searchRecipes) return;

    // Показываем секцию результатов
    resultsSection.style.display = 'block';

    // Показываем индикатор загрузки
    searchRecipes.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="spinner" style="width: 40px; height: 40px; border: 4px solid var(--light-green); border-top: 4px solid var(--primary-green); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <p style="color: var(--text-light);">Ищем рецепты с "${detection.name_ru || detection.name}"...</p>
        </div>
    `;

    // Загружаем рецепты (используем существующую функцию loadRecipes)
    if (typeof loadRecipes === 'function') {
        loadRecipes().then(allRecipes => {
            // Фильтруем рецепты по найденному овощу
            const matchingRecipes = filterRecipesByVegetable(allRecipes, detection);

            // Отображаем результаты
            displayVegetableRecipes(searchRecipes, matchingRecipes, detection);
        }).catch(error => {
            console.error('Error loading recipes:', error);
            searchRecipes.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-light);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--light-orange); margin-bottom: 20px;"></i>
                    <p>Не удалось загрузить рецепты. Пожалуйста, попробуйте позже.</p>
                </div>
            `;
        });
    } else {
        // Если функция loadRecipes не определена, показываем сообщение
        searchRecipes.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-light);">
                <p>Функция поиска рецептов временно недоступна.</p>
            </div>
        `;
    }
}

function filterRecipesByVegetable(recipes, detection) {
    if (!recipes || !Array.isArray(recipes)) return [];

    const vegetableName = detection.name.toLowerCase();
    const vegetableNameRu = detection.name_ru ? detection.name_ru.toLowerCase() : vegetableName;

    return recipes.filter(recipe => {
        // Проверяем название рецепта
        if (recipe.title) {
            const titleLower = recipe.title.toLowerCase();
            if (titleLower.includes(vegetableName) || titleLower.includes(vegetableNameRu)) {
                return true;
            }
        }

        // Проверяем ингредиенты
        if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
            const hasVegetable = recipe.ingredients.some(ingredient => {
                const ingredientLower = ingredient.toLowerCase();
                return ingredientLower.includes(vegetableName) ||
                       ingredientLower.includes(vegetableNameRu) ||
                       vegetableName.includes(ingredientLower) ||
                       vegetableNameRu.includes(ingredientLower);
            });

            if (hasVegetable) return true;
        }

        // Проверяем описание
        if (recipe.description) {
            const descLower = recipe.description.toLowerCase();
            if (descLower.includes(vegetableName) || descLower.includes(vegetableNameRu)) {
                return true;
            }
        }

        return false;
    }).slice(0, 12); // Ограничиваем количество результатов
}

function displayVegetableRecipes(container, recipes, detection) {
    if (!container) return;

    if (recipes.length > 0) {
        container.innerHTML = '';

        // Заголовок
        const title = document.createElement('h3');
        title.innerHTML = `<i class="fas fa-utensils" style="color: var(--primary-green); margin-right: 10px;"></i>Рецепты с ${detection.name_ru || detection.name}`;
        title.style.color = 'var(--dark-green)';
        title.style.marginBottom = '25px';
        title.style.fontSize = '1.5rem';
        container.appendChild(title);

        // Создаем контейнер для рецептов
        const recipesGrid = document.createElement('div');
        recipesGrid.className = 'recipes-container';
        recipesGrid.style.display = 'grid';
        recipesGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
        recipesGrid.style.gap = '25px';

        // Используем существующую функцию createRecipeElement, если она есть
        if (typeof createRecipeElement === 'function') {
            recipes.forEach(recipe => {
                const recipeElement = createRecipeElement(recipe);
                recipesGrid.appendChild(recipeElement);
            });
        } else {
            // Альтернативное отображение, если функция не определена
            recipes.forEach(recipe => {
                const recipeCard = document.createElement('div');
                recipeCard.className = 'recipe-card';
                recipeCard.style.cssText = `
                    background: white;
                    border-radius: 15px;
                    overflow: hidden;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.08);
                    transition: transform 0.3s ease;
                    cursor: pointer;
                `;
                recipeCard.innerHTML = `
                    <div style="height: 180px; background: var(--light-green); display: flex; align-items: center; justify-content: center; color: var(--primary-green); font-size: 3rem;">
                        <i class="fas fa-utensils"></i>
                    </div>
                    <div style="padding: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: var(--dark-green); font-size: 1.1rem;">${recipe.title || 'Без названия'}</h4>
                        <p style="color: var(--text-light); font-size: 0.9rem; margin: 0 0 15px 0; line-height: 1.4;">
                            ${recipe.description || 'Описание отсутствует'}
                        </p>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--primary-green); font-weight: bold;">
                                <i class="fas fa-clock"></i> ${recipe.time || '?? мин'}
                            </span>
                            <span style="background: var(--light-green); color: var(--primary-green); padding: 5px 12px; border-radius: 15px; font-size: 0.85rem;">
                                ${recipe.difficulty || 'Не указано'}
                            </span>
                        </div>
                    </div>
                `;
                recipesGrid.appendChild(recipeCard);
            });
        }

        container.appendChild(recipesGrid);

        // Добавляем кнопку для создания рецепта
        if (recipes.length < 5) {
            const createRecipeBtn = document.createElement('div');
            createRecipeBtn.style.marginTop = '30px';
            createRecipeBtn.style.textAlign = 'center';
            createRecipeBtn.innerHTML = `
                <p style="color: var(--text-light); margin-bottom: 15px;">
                    Мало рецептов? Создайте свой собственный с ${detection.name_ru || detection.name}!
                </p>
                <button onclick="switchToCreateTab('${detection.name_ru || detection.name}')"
                        style="background: var(--light-orange); color: white; border: none; padding: 12px 30px; border-radius: 25px; cursor: pointer; font-size: 1rem; display: inline-flex; align-items: center; gap: 10px; font-weight: bold;">
                    <i class="fas fa-plus-circle"></i> Создать рецепт
                </button>
            `;
            container.appendChild(createRecipeBtn);
        }
    } else {
        container.innerHTML = `
            <div style="text-align: center; padding: 50px 20px;">
                <div style="width: 100px; height: 100px; background: var(--light-green); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 25px; color: var(--primary-green); font-size: 3rem;">
                    <i class="fas fa-search"></i>
                </div>
                <h3 style="color: var(--dark-green); margin-bottom: 15px;">Рецепты не найдены</h3>
                <p style="color: var(--text-light); max-width: 500px; margin: 0 auto 25px;">
                    К сожалению, мы не нашли рецептов с "${detection.name_ru || detection.name}".
                    Но вы можете создать свой собственный рецепт!
                </p>
                <button onclick="switchToCreateTab('${detection.name_ru || detection.name}')"
                        style="background: var(--primary-green); color: white; border: none; padding: 15px 35px; border-radius: 25px; cursor: pointer; font-size: 1.1rem; display: inline-flex; align-items: center; gap: 10px; font-weight: bold;">
                    <i class="fas fa-plus-circle"></i> Создать рецепт с ${detection.name_ru || detection.name}
                </button>
            </div>
        `;
    }
}

// ================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==================

function showPhotoLoading(show) {
    // Создаем или удаляем индикатор загрузки
    const existingLoader = document.getElementById('photo-search-loader');

    if (show) {
        if (existingLoader) return;

        const loader = document.createElement('div');
        loader.id = 'photo-search-loader';
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.95);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            animation: fadeIn 0.3s ease-out;
        `;

        loader.innerHTML = `
            <div class="spinner" style="width: 60px; height: 60px; border: 5px solid var(--light-green); border-top: 5px solid var(--primary-green); border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <p style="margin-top: 25px; color: var(--dark-green); font-size: 1.2rem; font-weight: 600;">Анализируем изображение...</p>
            <p style="color: var(--text-light); margin-top: 10px; max-width: 300px; text-align: center;">
                Искусственный интеллект определяет овощ на фото
            </p>
        `;

        document.body.appendChild(loader);
    } else {
        if (existingLoader) {
            existingLoader.remove();
        }
    }
}

function showPhotoUploadError(title, message) {
    alert(`❌ ${title}\n\n${message}`);
}

function getVegetableEmoji(vegetableName) {
    const emojiMap = {
        'помидор': '🍅',
        'томат': '🍅',
        'tomato': '🍅',
        'огурец': '🥒',
        'cucumber': '🥒',
        'морковь': '🥕',
        'carrot': '🥕',
        'картофель': '🥔',
        'potato': '🥔',
        'капуста': '🥬',
        'cabbage': '🥬',
        'брокколи': '🥦',
        'broccoli': '🥦',
        'баклажан': '🍆',
        'brinjal': '🍆',
        'перец': '🫑',
        'capsicum': '🫑',
        'тыква': '🎃',
        'pumpkin': '🎃',
        'редис': '🌶️',
        'radish': '🌶️',
        'фасоль': '🫛',
        'bean': '🫛',
        'папайя': '🍈',
        'papaya': '🍈'
    };

    const lowerName = vegetableName.toLowerCase();
    for (const [key, emoji] of Object.entries(emojiMap)) {
        if (lowerName.includes(key)) {
            return emoji;
        }
    }

    return '🥗'; // Общий эмодзи для овощей
}

function getConfidenceColor(confidence) {
    if (confidence > 0.7) return 'var(--light-green)';
    if (confidence > 0.4) return '#FFF3CD';
    return '#F8D7DA';
}

function getConfidenceTextColor(confidence) {
    if (confidence > 0.7) return 'var(--primary-green)';
    if (confidence > 0.4) return '#856404';
    return '#721C24';
}

function downloadDetectionImage(imageBase64) {
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${imageBase64}`;
    link.download = `cookly_detection_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Показываем уведомление
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--primary-green);
        color: white;
        padding: 12px 25px;
        border-radius: 25px;
        z-index: 10001;
        animation: slideIn 0.3s ease-out;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    `;
    notification.innerHTML = '<i class="fas fa-check" style="margin-right: 8px;"></i> Изображение сохранено!';

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);

    // Добавляем стили для анимации уведомления
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
}

function switchToCreateTab(vegetableName) {
    // Переключаемся на вкладку создания рецепта
    const createTab = document.getElementById('create');
    const searchTab = document.getElementById('search');

    if (createTab && searchTab) {
        // Скрываем поиск, показываем создание
        searchTab.classList.remove('active');
        createTab.classList.add('active');

        // Обновляем навигацию
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector('.nav-tab[data-tab="create"]').classList.add('active');

        // Заполняем поле названия рецепта
        const titleInput = document.getElementById('recipe-title');
        if (titleInput && vegetableName) {
            titleInput.value = `Рецепт с ${vegetableName}`;
            titleInput.focus();
        }

        // Прокручиваем к началу формы
        window.scrollTo(0, 0);
    }
}

// ================== КОНЕЦ ДОПОЛНИТЕЛЬНОГО КОДА ==================