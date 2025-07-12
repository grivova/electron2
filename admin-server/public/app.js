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
    let ws; 

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
                logger.error('Ошибка при получении статуса:', err);
                statusElement.textContent = 'Ошибка';
                statusElement.style.color = 'orange';
            });
    }

    refreshBtn.addEventListener('click', fetchStatus);
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
    function fetchConfig() {
        fetch('/api/config')
            .then(response => response.json())
            .then(config => {
                payslipsPathInput.value = config.payslipsPath;
            })
            .catch(err => {
                logger.error('Ошибка при получении конфигурации:', err);
                configStatus.textContent = 'Не удалось загрузить конфигурацию.';
                configStatus.style.color = 'red';
            });
    }

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
            logger.error('Ошибка при сохранении конфигурации:', err);
            configStatus.textContent = 'Ошибка при сохранении.';
            configStatus.style.color = 'red';
        });
    });
    browseBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/browse');
            if (response.ok) {
                const data = await response.json();
                payslipsPathInput.value = data.path;
            } else {
                logger.info('Folder selection was canceled.');
            }
        } catch (error) {
            logger.error('Error opening folder dialog:', error);
            alert('Не удалось открыть диалог выбора папки.');
        }
    });

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
                logger.error('Ошибка при проверке статуса БД:', err);
                adminDbStatusEl.textContent = 'Ошибка';
                adminDbStatusEl.style.color = 'orange';
                backendDbStatusEl.textContent = 'Ошибка';
                backendDbStatusEl.style.color = 'orange';
            });
    }
    
    checkDbBtn.addEventListener('click', checkDbStatus);

    function clearLogs() {
        if (!confirm('Это действие удалит лог-файл полностью и навсегда. Вы уверены?')) {
            return;
        }
        fetch('/api/logs/clear', { method: 'POST' })
            .then(response => {
                if (response.ok) {
                    fetchLogs();
                } else {
                    alert('Не удалось очистить логи.');
                }
            })
            .catch(err => {
                logger.error('Ошибка при очистке логов:', err);
                alert('Произошла ошибка при очистке логов.');
            });
    }

    refreshLogsBtn.addEventListener('click', fetchLogs);
    clearLogsBtn.addEventListener('click', clearLogs);

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
            pingOutputEl.textContent = ''; 
            pingBtn.disabled = true;
            pingStopBtn.disabled = false;
            ws.send(JSON.stringify({ type: 'ping', ip }));
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            pingOutputEl.textContent += message.data;
            pingOutputEl.scrollTop = pingOutputEl.scrollHeight;
        };

        ws.onerror = (error) => {
            logger.error('WebSocket Error:', error);
            pingOutputEl.textContent += '\nОшибка WebSocket соединения.';
        };

        ws.onclose = () => {
            logger.info('WebSocket connection closed');
            pingBtn.disabled = false;
            pingStopBtn.disabled = true;
            ws = null;
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

    const cardLogsElement = document.getElementById('card-logs-content');
    const refreshCardLogsBtn = document.getElementById('refresh-card-logs-btn');

    function fetchCardLogs() {
        cardLogsElement.textContent = 'загрузка...';
        fetch('/api/card-logs')
            .then(response => {
                if (!response.ok) throw new Error('Не удалось загрузить логи считывателя');
                return response.text();
            })
            .then(data => {
                cardLogsElement.textContent = data || 'Лог-файл пуст.';
            })
            .catch(err => {
                cardLogsElement.textContent = `Ошибка при загрузке логов: ${err.message}`;
                cardLogsElement.style.color = '#ff6b6b';
            });
    }
    refreshCardLogsBtn.addEventListener('click', fetchCardLogs);

    fetchStatus();
    fetchConfig();
}); 