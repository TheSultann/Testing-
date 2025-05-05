// db.js
const { supabase, pieTypes } = require('./config'); // Импортируем supabase и pieTypes
const { getCurrentDate } = require('./utils'); // Импортируем getCurrentDate

// Получение цен из БД
async function getPricesFromDb(chatId) {
    // ... (код функции без изменений) ...
    // (Просто скопируй сюда весь код функции getPricesFromDb из старого файла)
    const { data, error } = await supabase
        .from('chat_settings')
        .select('pie_type, price')
        .eq('chat_id', chatId);

    if (error) {
        console.error(`[${chatId}] Ошибка получения цен из БД:`, error.message);
        const defaultPrices = pieTypes.reduce((acc, type) => { acc[type] = 0; return acc; }, {});
        return defaultPrices;
    }

    const prices = (data || []).reduce((acc, item) => {
        acc[item.pie_type] = parseFloat(item.price || 0);
        return acc;
    }, {});
    pieTypes.forEach(type => {
        if (!(type in prices)) { prices[type] = 0; }
    });
    return prices;
}

// Сохранение/Обновление цены в БД
async function savePriceToDb(chatId, pieType, price) {
    // ... (код функции без изменений) ...
    const { error } = await supabase
        .from('chat_settings')
        .upsert({ chat_id: chatId, pie_type: pieType, price: price }, { onConflict: 'chat_id, pie_type' });

    if (error) {
        console.error(`[${chatId}] Ошибка сохранения цены "${pieType}" (${price}) в БД:`, error.message);
    } else {
        console.log(`[${chatId}] Цена для "${pieType}" (${price}) успешно сохранена/обновлена.`);
    }
    return !error;
}

// Вызов RPC для добавления изготовленных
async function addManufacturedToDb(chatId, pieType, quantity) {
    // ... (код функции без изменений, но используем getCurrentDate из utils) ...
    const today = getCurrentDate(); // Используем импортированную функцию
    console.log(`[${chatId}] Вызов RPC upsert_daily_manufactured: pie=${pieType}, quantity=${quantity}, date=${today}`);
    const { data: newTotal, error } = await supabase.rpc('upsert_daily_manufactured', {
        p_chat_id: chatId,
        p_pie_type: pieType,
        p_add_quantity: quantity,
        p_log_date: today
    });

    if (error) {
        console.error(`[${chatId}] Ошибка вызова RPC upsert_daily_manufactured для "${pieType}":`, error.message, error.details);
        return null;
    }

    console.log(`[${chatId}] RPC upsert_daily_manufactured успешно. Новое manufactured для "${pieType}" за ${today}: ${newTotal}`);
    return newTotal;
}

// Получение данных за день для одного типа пирожка из БД
async function getDailyLogEntry(chatId, pieType) {
    // ... (код функции без изменений, но используем getCurrentDate из utils) ...
    const today = getCurrentDate();
    const { data, error } = await supabase
        .from('daily_log')
        .select('manufactured, remaining')
        .eq('chat_id', chatId)
        .eq('log_date', today)
        .eq('pie_type', pieType)
        .maybeSingle();

    if (error) {
        console.error(`[${chatId}] Ошибка получения записи daily_log для "${pieType}" за ${today}:`, error.message);
        return { manufactured: 0, remaining: null };
    }
    return data ? { manufactured: data.manufactured || 0, remaining: data.remaining } : { manufactured: 0, remaining: null };
}

// Получение всех логов за сегодня из БД, сгруппированных по типу
async function getTodaysLogsGrouped(chatId) {
    // ... (код функции без изменений, но используем getCurrentDate из utils) ...
     const today = getCurrentDate();
    const { data, error } = await supabase
        .from('daily_log')
        .select('pie_type, manufactured, remaining')
        .eq('chat_id', chatId)
        .eq('log_date', today);

    if (error) {
        console.error(`[${chatId}] Ошибка получения логов за ${today}:`, error.message);
        return {};
    }

    return (data || []).reduce((acc, log) => {
        acc[log.pie_type] = {
            manufactured: log.manufactured || 0,
            remaining: log.remaining
        };
        return acc;
    }, {});
}

// Сохранение остатков в БД
async function saveRemainingToDb(chatId, pieType, remainingQuantity) {
    // ... (код функции без изменений, но используем getCurrentDate из utils) ...
    const today = getCurrentDate();
    // Используем getDailyLogEntry из ЭТОГО ЖЕ файла
    const logEntry = await getDailyLogEntry(chatId, pieType);
    if (!logEntry || logEntry.manufactured <= 0) {
        console.error(`[${chatId}] Попытка сохранить остаток ${remainingQuantity} для "${pieType}", но запись в daily_log не найдена или manufactured=0.`);
        return false;
    }

    console.log(`[${chatId}] Обновление remaining в БД: pie=${pieType}, remaining=${remainingQuantity}, date=${today}`);
    const { error } = await supabase
        .from('daily_log')
        .update({ remaining: remainingQuantity, updated_at: new Date().toISOString() })
        .eq('chat_id', chatId)
        .eq('log_date', today)
        .eq('pie_type', pieType);

    if (error) {
        console.error(`[${chatId}] Ошибка сохранения остатка ${remainingQuantity} для "${pieType}" за ${today} в БД:`, error.message);
    } else {
        console.log(`[${chatId}] Остаток ${remainingQuantity} для "${pieType}" за ${today} успешно сохранен.`);
    }
    return !error;
}

// Вызов RPC для сохранения/обновления расходов
async function saveExpensesToDb(chatId, amountToAdd) {
    // ... (код функции без изменений, но используем getCurrentDate из utils) ...
    const today = getCurrentDate();
    console.log(`[${chatId}] Вызов RPC upsert_daily_expenses: amount=${amountToAdd}, date=${today}`);
    const { data: newTotal, error } = await supabase.rpc('upsert_daily_expenses', {
        p_chat_id: chatId,
        p_add_amount: amountToAdd,
        p_log_date: today
    });

    if (error) {
        console.error(`[${chatId}] Ошибка вызова RPC upsert_daily_expenses:`, error.message, error.details);
        return null;
    }
    console.log(`[${chatId}] RPC upsert_daily_expenses успешно. Новые expenses за ${today}: ${newTotal}`);
    return newTotal;
}

// Получение суммарной статистики за период
async function getStatsForPeriod(chatId, startDate, endDate) {
     // ... (код функции без изменений, но используем getPricesFromDb из этого файла) ...
    console.log(`[${chatId}] Запрос статистики за период: ${startDate} - ${endDate}`);

    // 1. Получаем цены (они не зависят от периода)
    const prices = await getPricesFromDb(chatId); // Используем функцию из этого модуля

    // 2. Получаем и суммируем логи пирожков за период
    const { data: logsData, error: logsError } = await supabase
        .from('daily_log')
        .select('log_date, pie_type, manufactured, remaining')
        .eq('chat_id', chatId)
        .gte('log_date', startDate)
        .lte('log_date', endDate);

    if (logsError) {
        console.error(`[${chatId}] Ошибка получения логов за период ${startDate}-${endDate}:`, logsError.message);
        return null;
    }

    // 3. Получаем и суммируем расходы за период
    const { data: expensesData, error: expensesError } = await supabase
        .from('daily_expenses')
        .select('expenses')
        .eq('chat_id', chatId)
        .gte('log_date', startDate)
        .lte('log_date', endDate);

     if (expensesError) {
        console.error(`[${chatId}] Ошибка получения расходов за период ${startDate}-${endDate}:`, expensesError.message);
    }
    const totalExpenses = (expensesData || []).reduce((sum, entry) => sum + parseFloat(entry.expenses || 0), 0);

    // 4. Собираем итоговую статистику
    const stats = {
        pies: {}, prices: prices, totalRevenue: 0,
        expenses: totalExpenses, profit: 0,
        period: { start: startDate, end: endDate }
    };

    // Группируем по типу и считаем суммарное manufactured и проданное
    const periodTotals = (logsData || []).reduce((acc, log) => {
        const type = log.pie_type;
        if (!acc[type]) {
            acc[type] = { manufactured: 0, sold: 0 };
        }
        acc[type].manufactured += log.manufactured || 0;
        if (log.manufactured > 0 && log.remaining !== null && log.remaining !== undefined) {
            const soldToday = log.manufactured - log.remaining;
            if (soldToday >= 0) {
                acc[type].sold += soldToday;
            } else {
                 console.warn(`[${chatId}] Ошибка данных за ${log.log_date}: Остаток > изготовлено для "${log.pie_type}"`);
            }
        }
        return acc;
    }, {});

    // Рассчитываем выручку и заполняем итоговый объект stats
    for (const type of pieTypes) {
        const totals = periodTotals[type] || { manufactured: 0, sold: 0 };
        const price = prices[type] || 0;
        const totalManufactured = totals.manufactured;
        const totalSold = totals.sold;
        const totalRevenueForType = totalSold * price;

        stats.pies[type] = {
            manufactured: totalManufactured,
            sold: totalSold,
            revenue: totalRevenueForType,
            price: price
        };
        if (totalRevenueForType > 0) stats.totalRevenue += totalRevenueForType;
    }

    stats.profit = stats.totalRevenue - stats.expenses;
    console.log(`[${chatId}] Статистика за период ${startDate}-${endDate} подсчитана.`);
    return stats;
}


// Экспортируем все функции, которые будут использоваться в bot.js
module.exports = {
    getPricesFromDb,
    savePriceToDb,
    addManufacturedToDb,
    getDailyLogEntry,
    getTodaysLogsGrouped,
    saveRemainingToDb,
    saveExpensesToDb,
    getStatsForPeriod
};