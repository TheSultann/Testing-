// config.js
const { createClient } = require('@supabase/supabase-js');

// --- Константы ---
const pieTypes = ['Мясо', 'Картошка', 'Сосиска в тесте'];
const currencySymbol = 'сум';

// --- ДОБАВЛЕНО: Список разрешенных Chat ID ---
// !!! ЗАМЕНИ НА РЕАЛЬНЫЕ ID через запятую, без пробелов !!!
// В будущем (на Render) это нужно будет перенести в process.env.ALLOWED_CHAT_IDS
const ALLOWED_CHAT_IDS = '467595754'; // Пример: '12345678,98765432'

// --- Подключение к Supabase ---
// В будущем лучше перенести в переменные окружения (.env)
const supabaseUrl = 'https://psrwxqpqmbhfbtqlhdjx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzcnd4cXBxbWJoZmJ0cWxoZGp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyNDI5MTcsImV4cCI6MjA2MTgxODkxN30.f3dTpEewBwDjgXEu4gNSF77r6c9GTk8ppr8H3AhfIW8';
const supabase = createClient(supabaseUrl, supabaseKey);
console.log('Supabase клиент создан (из config.js).');

// --- Настройки Telegram Бота ---
// В будущем лучше перенести в переменные окружения (.env)
const token = '7230683241:AAF-v7yXhxe55w27TFYaafURaSsTjtgnGHM';

module.exports = {
    pieTypes,
    currencySymbol,
    supabase, // Экспортируем готовый клиент supabase
    token,
    ALLOWED_CHAT_IDS // Экспортируем список ID
};