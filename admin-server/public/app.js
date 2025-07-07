document.addEventListener('DOMContentLoaded', () => {
    const statusElement = document.getElementById('server-status');
    const refreshBtn = document.getElementById('refresh-status-btn');
    const logsElement = document.getElementById('logs-content');
    const configForm = document.getElementById('config-form');
    const payslipsPathInput = document.getElementById('payslipsPath');
    const configStatus = document.getElementById('config-status');
    const browseBtn = document.getElementById('browse-btn');
    const dbStatusElement = document.getElementById('db-status');
    const checkDbBtn = document.getElementById('check-db-btn');
    const refreshLogsBtn = document.getElementById('refresh-logs-btn');
    const clearLogsBtn = document.getElementById('clear-logs-btn');
    const adminDbStatusEl = document.getElementById('admin-db-status');
    const adminDbMessageEl = document.getElementById('admin-db-message');
    const backendDbStatusEl = document.getElementById('backend-db-status');
    const backendDbMessageEl = document.getElementById('backend-db-message');
    const pingBtn = document.getElementById('ping-btn');
    const pingStopBtn = document.getElementById('ping-stop-btn');
    const pingClearBtn = document.getElementById('ping-clear-btn');
    const pingIpInput = document.getElementById('ping-ip');
    const pingOutputEl = document.getElementById('ping-output');
    let ws; // Переменная для хранения WebSocket соединения

    // --- Перехват формы логина ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = loginForm.elements['password'].value;
            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                if (response.ok) {
                    // Можно добавить переход на главную или обновление страницы
                    window.location.href = '/';
                } else {
                    alert('Неверный пароль');
                }
            } catch (err) {
                alert('Ошибка авторизации');
            }
        });
    }

    function fetchStatus() {
        fetch('/api/status')
            .then(response => response.json())
            .then(data => {
                if (data.status === 'online') {
                    statusElement.textContent = 'Онлайн';
                    statusElement.style.color = 'green';
                } else {
                    statusElement.textContent = 'Оффлайн';
                    statusElement.style.color = 'red';
                }
            })
            .catch(err => {
                console.error('Ошибка при получении статуса:', err);
                statusElement.textContent = 'Ошибка';
                statusElement.style.color = 'orange';
            });
    }

    // Обработчик нажатия на кнопку "Обновить"
    refreshBtn.addEventListener('click', fetchStatus);

    // Функция для получения логов
    function fetchLogs() {
        logsElement.textContent = 'загрузка...';
        fetch('/api/logs')
            .then(response => {
                if (!response.ok) throw new Error('Не удалось загрузить логи');
                return response.text();
            })
            .then(data => {
                logsElement.textContent = data || 'Лог-файл пуст.';
            })
            .catch(err => {
                logsElement.textContent = `Ошибка при загрузке логов: ${err.message}`;
                logsElement.style.color = '#ff6b6b';
            });
    }

    // Функция для получения и отображения конфигурации
    function fetchConfig() {
        fetch('/api/config')
            .then(response => response.json())
            .then(config => {
                payslipsPathInput.value = config.payslipsPath;
            })
            .catch(err => {
                console.error('Ошибка при получении конфигурации:', err);
                configStatus.textContent = 'Не удалось загрузить конфигурацию.';
                configStatus.style.color = 'red';
            });
    }

    // Обработчик сохранения формы
    configForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newConfig = {
            payslipsPath: payslipsPathInput.value
        };

        fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newConfig)
        })
        .then(response => response.json())
        .then(data => {
            configStatus.textContent = 'Конфигурация успешно сохранена!';
            configStatus.style.color = 'green';
            setTimeout(() => { configStatus.textContent = ''; }, 3000);
        })
        .catch(err => {
            console.error('Ошибка при сохранении конфигурации:', err);
            configStatus.textContent = 'Ошибка при сохранении.';
            configStatus.style.color = 'red';
        });
    });

    // Обработчик нажатия на кнопку "Обзор"
    browseBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/browse');
            if (response.ok) {
                const data = await response.json();
                payslipsPathInput.value = data.path;
            } else {
                console.info('Folder selection was canceled.');
            }
        } catch (error) {
            console.error('Error opening folder dialog:', error);
            alert('Не удалось открыть диалог выбора папки.');
        }
    });

    // Функция для отрисовки статуса
    function renderStatus(element, messageEl, data) {
        messageEl.textContent = data.message;
        if (data.status === 'online') {
            element.textContent = 'Онлайн';
            element.style.color = 'green';
        } else {
            element.textContent = 'Оффлайн';
            element.style.color = 'red';
        }
    }

    // Функция для проверки статуса БД
    function checkDbStatus() {
        adminDbStatusEl.textContent = 'проверка...';
        backendDbStatusEl.textContent = 'проверка...';
        adminDbMessageEl.textContent = '';
        backendDbMessageEl.textContent = '';
        adminDbStatusEl.style.color = '#333';
        backendDbStatusEl.style.color = '#333';

        fetch('/api/check-db')
            .then(response => response.json())
            .then(data => {
                renderStatus(adminDbStatusEl, adminDbMessageEl, data.adminToDb);
                renderStatus(backendDbStatusEl, backendDbMessageEl, data.backendToDb);
            })
            .catch(err => {
                console.error('Ошибка при проверке статуса БД:', err);
                adminDbStatusEl.textContent = 'Ошибка';
                adminDbStatusEl.style.color = 'orange';
                backendDbStatusEl.textContent = 'Ошибка';
                backendDbStatusEl.style.color = 'orange';
            });
    }
    
    checkDbBtn.addEventListener('click', checkDbStatus);

    // Функция для очистки логов
    function clearLogs() {
        if (!confirm('Вы уверены, что хотите очистить лог-файл? Это действие необратимо.')) {
            return;
        }
        fetch('/api/logs/clear', { method: 'POST' })
            .then(response => {
                if (response.ok) {
                    fetchLogs(); // Обновляем логи после очистки
                } else {
                    alert('Не удалось очистить логи.');
                }
            })
            .catch(err => {
                console.error('Ошибка при очистке логов:', err);
                alert('Произошла ошибка при очистке логов.');
            });
    }

    refreshLogsBtn.addEventListener('click', fetchLogs);
    clearLogsBtn.addEventListener('click', clearLogs);

    // Функция для пинга через WebSocket
    function doPing() {
        const ip = pingIpInput.value.trim();
        if (!ip) {
            pingOutputEl.textContent = 'Пожалуйста, введите IP-адрес.';
            return;
        }
        if (ws) {
            ws.close();
        }
        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        ws = new WebSocket(`${wsProtocol}://${window.location.host}`);

        ws.onopen = () => {
            pingOutputEl.textContent = ''; // Очищаем вывод
            pingBtn.disabled = true;
            pingStopBtn.disabled = false;
            // Отправляем команду на сервер
            ws.send(JSON.stringify({ type: 'ping', ip }));
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            // Добавляем новые данные в консоль, прокручивая вниз
            pingOutputEl.textContent += message.data;
            pingOutputEl.scrollTop = pingOutputEl.scrollHeight;
        };

        ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            pingOutputEl.textContent += '\nОшибка WebSocket соединения.';
        };

        ws.onclose = () => {
            console.log('WebSocket connection closed');
            pingBtn.disabled = false;
            pingStopBtn.disabled = true;
            ws = null; // Очищаем переменную
        };
    }

    function stopPing() {
        if (ws) {
            ws.close();
        }
    }

    function clearPingOutput() {
        pingOutputEl.textContent = '';
    }

    pingBtn.addEventListener('click', doPing);
    pingStopBtn.addEventListener('click', stopPing);
    pingClearBtn.addEventListener('click', clearPingOutput);

    fetchStatus();
    fetchConfig();
}); 