const TelegramBot = require('node-telegram-bot-api');

// Замените 'YOUR_TELEGRAM_BOT_TOKEN' на ваш токен, если он изменился
const token = '7230683241:AAF-v7yXhxe55w27TFYaafURaSsTjtgnGHM';
const bot = new TelegramBot(token, { polling: true });

console.log('Бот запущен...');

// --- Константы ---
const pieTypes = ['Мясо', 'Картошка', 'Капуста'];

// --- Хранилища данных ---
let dailyData = {}; // { chatId: { manufactured: {}, remaining: {}, expenses: 0 } }
let userState = {}; // { chatId: { action: null, data: {} } }
let settings = {}; // { chatId: { prices: { 'Мясо': 100, ... } } }

// --- Клавиатуры ---
const mainKeyboard = {
    reply_markup: {
        keyboard: [
            ['➕ Добавить изготовленные пирожки'],
            ['📦 Ввести остатки', '💰 Ввести расходы'],
            ['📊 Посмотреть статистику', '🛠 Настройки']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    }
};

const pieTypesKeyboard = { // Инлайн клавиатура для добавления изготовленных
    reply_markup: {
        inline_keyboard: [
            ...pieTypes.map(type => ([{ text: type, callback_data: `add_pie_${type}` }]))
        ]
    }
};

// --- Клавиатура для Настроек ---
function createSettingsKeyboard(chatId) {
    const currentPrices = settings[chatId]?.prices || {};
    const buttons = pieTypes.map(type => {
        const price = currentPrices[type] !== undefined ? `(${currentPrices[type]} руб.)` : '(не задана)';
        return [{ text: `💲 ${type} ${price}`, callback_data: `set_price_${type}` }];
    });
    buttons.push([{ text: '🔙 Назад', callback_data: 'back_to_main' }]); // Кнопка Назад

    return {
        reply_markup: {
            inline_keyboard: buttons
        }
    };
}


// --- Функции инициализации ---
function initializeChatData(chatId) {
    // Данные дня
    if (!dailyData[chatId]) {
        dailyData[chatId] = {
            manufactured: pieTypes.reduce((acc, type) => { acc[type] = 0; return acc; }, {}),
            remaining: pieTypes.reduce((acc, type) => { acc[type] = null; return acc; }, {}),
            expenses: 0
        };
        console.log(`[${chatId}] Инициализированы данные дня.`); // ОТЛАДКА
    }
    // Настройки
    if (!settings[chatId]) {
        settings[chatId] = {
            prices: pieTypes.reduce((acc, type) => { acc[type] = 0; return acc; }, {}) // Иниц. цены нулями
        };
         console.log(`[${chatId}] Инициализированы настройки.`); // ОТЛАДКА
    }
    // Состояние
     if (!userState[chatId]) {
        userState[chatId] = { action: null, data: {} };
        console.log(`[${chatId}] Инициализировано состояние пользователя.`); // ОТЛАДКА
    }
}

// --- Вспомогательная функция для запроса остатка ---
function askForRemaining(chatId, pieIndex) {
    if (pieIndex < pieTypes.length) {
        const currentPieType = pieTypes[pieIndex];
        userState[chatId] = { action: 'awaiting_remaining_input', data: { currentPieIndex: pieIndex } };
        bot.sendMessage(chatId, `Сколько осталось пирожков "${currentPieType}"? Введи число (0, если не осталось):`);
    } else {
        bot.sendMessage(chatId, '✅ Все остатки записаны!', mainKeyboard);
        userState[chatId] = { action: null, data: {} }; // Сброс состояния
    }
}

// --- Обработчики команд и сообщений ---

// /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    initializeChatData(chatId);
    bot.sendMessage(chatId, 'Привет! Я помогу тебе вести учет пирожков. Выбери действие:', mainKeyboard);
});

// Обработка текстовых сообщений (кнопки и ввод данных)
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Игнорируем сообщения без текста
    if (!text) {
         console.log(`[${chatId}] Получено нетекстовое сообщение.`); // ОТЛАДКА
        return;
    }

    initializeChatData(chatId);
    const state = userState[chatId];
    const chatData = dailyData[chatId];
    const chatSettings = settings[chatId]; // Получаем настройки

    // --- ОТЛАДКА ---
    console.log(`[${chatId}] Получен текст: "${text}" | Текущее состояние: ${state?.action || 'нет'}`);
    // --- КОНЕЦ ОТЛАДКИ ---

    // 1. Проверяем состояние пользователя
    if (state && state.action === 'awaiting_pie_quantity') { // --- Ввод количества ИЗГОТОВЛЕННЫХ ---
        console.log(`[${chatId}] Обработка состояния: awaiting_pie_quantity`); // ОТЛАДКА
        const quantity = parseInt(text, 10);
        if (isNaN(quantity) || quantity <= 0) {
            bot.sendMessage(chatId, '❌ Пожалуйста, введи корректное число (больше нуля).');
            return; // Остаемся в том же состоянии ожидания
        }
        const pieType = state.data.type;
        chatData.manufactured[pieType] = (chatData.manufactured[pieType] || 0) + quantity;
        bot.sendMessage(chatId, `✅ Добавлено: ${quantity} пирожков "${pieType}".\nВсего изготовлено "${pieType}" сегодня: ${chatData.manufactured[pieType]}.`, mainKeyboard);
        userState[chatId] = { action: null, data: {} }; // Сброс состояния
        return;

    } else if (state && state.action === 'awaiting_remaining_input') { // --- Ввод ОСТАТКОВ ---
        console.log(`[${chatId}] Обработка состояния: awaiting_remaining_input`); // ОТЛАДКА
        const quantity = parseInt(text, 10);
        const currentPieIndex = state.data.currentPieIndex;
        const pieType = pieTypes[currentPieIndex];
        const manufacturedCount = chatData.manufactured[pieType] || 0;

        if (isNaN(quantity) || quantity < 0) {
            bot.sendMessage(chatId, `❌ Введи корректное число (0 или больше) для остатка "${pieType}".`);
            return; // Остаемся в том же состоянии, ждем корректный ввод
        }
        if (quantity > manufacturedCount) {
             bot.sendMessage(chatId, `❌ Ошибка: остаток (${quantity}) не может быть больше, чем изготовлено (${manufacturedCount}) для пирожков "${pieType}".\nПопробуй ввести остаток для "${pieType}" еще раз:`);
             return; // Остаемся в том же состоянии, ждем корректный ввод
        }
        chatData.remaining[pieType] = quantity;
        bot.sendMessage(chatId, `👍 Записан остаток для "${pieType}": ${quantity}.`);
        askForRemaining(chatId, currentPieIndex + 1); // Переходим к следующему пирожку
        return;

    } else if (state && state.action === 'awaiting_expenses_input') { // --- Ввод РАСХОДОВ ---
        console.log(`[${chatId}] Обработка состояния: awaiting_expenses_input`); // ОТЛАДКА
        const amount = parseFloat(text.replace(',', '.')); // Парсим число, заменяем запятую на точку для дробных
        if (isNaN(amount) || amount < 0) {
            bot.sendMessage(chatId, '❌ Пожалуйста, введи корректную сумму расходов (число, 0 или больше).');
            return; // Остаемся в ожидании ввода расходов
        }
        chatData.expenses = amount; // Сохраняем расходы
        bot.sendMessage(chatId, `✅ Расходы за день (${amount}) записаны.`, mainKeyboard); // Возвращаем главное меню
        userState[chatId] = { action: null, data: {} }; // Сбрасываем состояние
        return;

    } else if (state && state.action === 'awaiting_price_input') { // --- Ввод ЦЕНЫ ---
        console.log(`[${chatId}] Обработка состояния: awaiting_price_input`); // ОТЛАДКА
        const price = parseFloat(text.replace(',', '.'));
        const pieType = state.data.type;

        if (isNaN(price) || price < 0) {
             bot.sendMessage(chatId, '❌ Пожалуйста, введи корректную цену (число, 0 или больше).');
            return; // Остаемся в ожидании ввода цены
        }
        // Сохраняем цену в настройках
        if (!chatSettings.prices) chatSettings.prices = {}; // Убедимся, что объект цен существует
        chatSettings.prices[pieType] = price;
        bot.sendMessage(chatId, `✅ Цена для пирожков "${pieType}" установлена: ${price} руб.`);
        // Возвращаемся в меню настроек
        userState[chatId] = { action: null, data: {} }; // Сбрасываем состояние
        const settingsKeyboard = createSettingsKeyboard(chatId);
        bot.sendMessage(chatId, 'Текущие настройки цен:', settingsKeyboard);
        return;
    }

    // --- ОТЛАДКА ---
    // Если мы дошли сюда, значит, ни одно состояние не активно
    console.log(`[${chatId}] Состояние не активно, обрабатываем кнопки меню для текста: "${text}"`);
    // --- КОНЕЦ ОТЛАДКИ ---

    // 2. Обрабатываем нажатия кнопок главного меню (только если состояние не активно)
    switch (text) {
        case '➕ Добавить изготовленные пирожки':
            console.log(`[${chatId}] Сработало меню: Добавить изготовленные`); // ОТЛАДКА
            bot.sendMessage(chatId, 'Какой тип пирожков изготовили?', pieTypesKeyboard);
            break;
        case '📦 Ввести остатки':
            console.log(`[${chatId}] Сработало меню: Ввести остатки`); // ОТЛАДКА
            bot.sendMessage(chatId, 'Начинаем ввод остатков...');
            askForRemaining(chatId, 0);
            break;
        case '💰 Ввести расходы':
            console.log(`[${chatId}] Сработало меню: Ввести расходы`); // ОТЛАДКА
            userState[chatId] = { action: 'awaiting_expenses_input', data: {} };
            bot.sendMessage(chatId, 'Введи общую сумму расходов за день (например, 500 или 125.50):');
            break;
        case '📊 Посмотреть статистику':
            console.log(`[${chatId}] Сработало меню: Посмотреть статистику`); // ОТЛАДКА
            let report = '📊 Статистика за сегодня:\n\n';
            let allRemainingsEntered = true;
            let totalRevenue = 0; // Для подсчета выручки

            pieTypes.forEach(type => {
                const manufactured = chatData.manufactured[type] || 0;
                const remaining = chatData.remaining[type];
                const price = chatSettings.prices[type] || 0; // Берем цену из настроек

                report += `Пирожки "${type}" (цена: ${price} руб.):\n`; // Показываем цену
                report += `- Изготовлено: ${manufactured}\n`;

                if (remaining !== null) {
                    const sold = manufactured - remaining;
                    const revenue = sold * price;
                    totalRevenue += revenue; // Суммируем выручку
                    report += `- Остаток: ${remaining}\n`;
                    report += `- Продано: ${sold} шт.\n`;
                    report += `- Выручка (${type}): ${revenue} руб.\n\n`;
                } else {
                    report += `- Остаток: (не введен)\n`;
                    report += `- Продано: (неизвестно)\n\n`;
                    allRemainingsEntered = false;
                }
            });

            report += `Общая выручка: ${totalRevenue} руб.\n`;
            report += `💸 Расходы за день: ${chatData.expenses} руб.\n`;

            if (allRemainingsEntered) {
                const profit = totalRevenue - chatData.expenses;
                report += `📈 Чистая прибыль: ${profit} руб.\n\n`;
            } else {
                 report += '⚠️ Чтобы увидеть чистую прибыль, введите остатки по всем типам.\n\n';
            }

            bot.sendMessage(chatId, report, mainKeyboard); // Отправляем отчет
            break;
        case '🛠 Настройки':
            console.log(`[${chatId}] Сработало меню: Настройки`); // ОТЛАДКА
            const settingsKeyboard = createSettingsKeyboard(chatId);
            bot.sendMessage(chatId, '⚙️ Настройки цен на пирожки:', settingsKeyboard);
            break;
        default:
             // Если текст не соответствует ни одному состоянию и ни одной кнопке
             console.log(`[${chatId}] Неизвестный текст или команда: "${text}"`); // ОТЛАДКА
             // Можно раскомментировать, если нужно сообщение об ошибке пользователю
             // bot.sendMessage(chatId, 'Не понимаю команду. Используй кнопки.');
             break;
    }
});

// Обработка нажатий инлайн-кнопок
bot.on('callback_query', (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;

    initializeChatData(chatId); // Убедимся, что все инициализировано

    console.log(`[${chatId}] Получен callback_query: ${data}`); // ОТЛАДКА

    if (data.startsWith('add_pie_')) { // --- Добавление изготовленных ---
        const pieType = data.split('_')[2];
        userState[chatId] = { action: 'awaiting_pie_quantity', data: { type: pieType } };
        bot.sendMessage(chatId, `Сколько пирожков "${pieType}" изготовили? Введи число:`);
        // Пытаемся убрать инлайн-кнопки из сообщения, где была нажата кнопка
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: msg.message_id })
           .catch(e => console.log(`[${chatId}] Warning: Не удалось изменить кнопки. ${e.message}`)); // Мягкая обработка ошибки
        bot.answerCallbackQuery(callbackQuery.id);

    } else if (data.startsWith('set_price_')) { // --- Установка цены ---
        const pieType = data.split('_')[2];
        userState[chatId] = { action: 'awaiting_price_input', data: { type: pieType } }; // Устанавливаем состояние
        bot.sendMessage(chatId, `Введи новую цену для пирожков "${pieType}" (например, 100 или 85.50):`);
        // Редактируем сообщение настроек, убирая кнопки и указывая на ожидание ввода
        bot.editMessageText(`⚙️ Настройки цен на пирожки:\n\n(Введи новую цену для "${pieType}")`, { chat_id: chatId, message_id: msg.message_id, reply_markup: { inline_keyboard: [] } })
           .catch(e => console.log(`[${chatId}] Warning: Не удалось изменить текст/кнопки настроек. ${e.message}`)); // Мягкая обработка ошибки
        bot.answerCallbackQuery(callbackQuery.id);

    } else if (data === 'back_to_main') { // --- Кнопка Назад в настройках ---
         // Редактируем сообщение настроек, чтобы показать, что возвращаемся
         bot.editMessageText('Возвращаемся в главное меню...', { chat_id: chatId, message_id: msg.message_id, reply_markup: { inline_keyboard: [] } })
            .catch(e => console.log(`[${chatId}] Warning: Не удалось изменить текст/кнопки при возврате. ${e.message}`)); // Мягкая обработка ошибки
         bot.sendMessage(chatId, 'Выбери действие:', mainKeyboard); // Показываем основную клавиатуру
         bot.answerCallbackQuery(callbackQuery.id);
    }
    // Добавить обработку 'reset_daily_data', если нужно
});


// --- Обработка ошибок --- (более детальная)
bot.on('polling_error', (error) => {
  console.error(`[Polling Error] Code: ${error.code} | Message: ${error.message}`);
  // Можно добавить логику перезапуска или уведомления администратора
});

bot.on('webhook_error', (error) => {
  console.error(`[Webhook Error] Code: ${error.code} | Message: ${error.message}`);
});

bot.on("error", (err) => {
  console.error("[General Bot Error]", err);
});

process.on('uncaughtException', (error, origin) => {
  console.error(`\nНеперехваченное исключение: ${error}`);
  console.error(`Источник: ${origin}`);
  // Здесь можно добавить логику для безопасного завершения или перезапуска
  // process.exit(1); // Рассмотреть возможность выхода, если ошибка критическая
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанный reject промиса:', promise);
  console.error(`Причина: ${reason}`);
});