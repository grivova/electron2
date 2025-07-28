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
                const response = await fetch('/api/auth', {
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
                console.error('Ошибка при получении статуса:', err);
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
                console.error('Ошибка при получении конфигурации:', err);
                configStatus.textContent = 'Не удалось загрузить конфигурацию.';
                configStatus.style.color = 'red';
            });
    }

configForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newConfig = {
        payslipsPath: payslipsPathInput.value
    };

    apiFetch('/api/config', {
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

        fetch('/api/health/check-db')
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
                console.error('Ошибка при очистке логов:', err);
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
            console.error('WebSocket Error:', error);
            pingOutputEl.textContent += '\nОшибка WebSocket соединения.';
        };

        ws.onclose = () => {
            console.info('WebSocket connection closed');
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
        fetch('/api/card/card-logs')
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

    // --- ТАБЫ ---
    const tabMainBtn = document.getElementById('tab-main');
    const tabSettingsBtn = document.getElementById('tab-settings');
    const tabMonitoringBtn = document.getElementById('tab-monitoring');
    const mainTab = document.getElementById('main-tab');
    const settingsTab = document.getElementById('settings-tab');
    const monitoringTab = document.getElementById('monitoring-tab');

    function showTab(tab) {
        mainTab.style.display = 'none';
        settingsTab.style.display = 'none';
        monitoringTab.style.display = 'none';
        tabMainBtn.classList.remove('active');
        tabSettingsBtn.classList.remove('active');
        tabMonitoringBtn.classList.remove('active');

        if (tab === 'main') {
            mainTab.style.display = '';
            tabMainBtn.classList.add('active');
        } else if (tab === 'settings') {
            settingsTab.style.display = '';
            tabSettingsBtn.classList.add('active');
            initSettingsTab();
        } else if (tab === 'monitoring') {
            monitoringTab.style.display = '';
            tabMonitoringBtn.classList.add('active');
            initMonitoringTab();
        }
    }
    tabMainBtn.addEventListener('click', () => showTab('main'));
    tabSettingsBtn.addEventListener('click', () => showTab('settings'));
    tabMonitoringBtn.addEventListener('click', () => showTab('monitoring'));

    // --- TOAST ---
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => container.removeChild(toast), 300);
        }, 3000);
    }

    // --- CSRF TOKEN ---
    let csrfToken = null;
    async function fetchCsrfToken() {
        try {
            const res = await fetch('/moders/csrf-token', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                csrfToken = data.csrfToken;
            }
        } catch (e) { csrfToken = null; }
    }
    // Обёртка для fetch с CSRF и credentials
    async function apiFetch(url, options = {}) {
        if (!options.headers) options.headers = {};
        if (['POST','PUT','DELETE'].includes((options.method||'GET').toUpperCase())) {
            if (!csrfToken) await fetchCsrfToken();
            options.headers['X-CSRF-Token'] = csrfToken;
        }
        options.credentials = 'include';
        return fetch(url, options);
    }

    // --- Модальное окно подтверждения ---
    const confirmModal = document.getElementById('confirm-modal');
    const confirmModalText = document.getElementById('confirm-modal-text');
    const confirmModalYes = document.getElementById('confirm-modal-yes');
    const confirmModalNo = document.getElementById('confirm-modal-no');

    function showConfirm(text, onConfirm) {
        confirmModalText.textContent = text;
        confirmModal.style.display = 'flex';

        const yesListener = () => {
            onConfirm();
            closeConfirm();
        };

        const closeConfirm = () => {
            confirmModal.style.display = 'none';
            confirmModalYes.removeEventListener('click', yesListener);
            confirmModalNo.removeEventListener('click', closeConfirm);
        }

        confirmModalYes.addEventListener('click', yesListener);
        confirmModalNo.addEventListener('click', closeConfirm);
    }


    // --- ВКЛАДКА МОНИТОРИНГА ---
    let monitoringInitialized = false;
    let allMonitoringEvents = []; // Кэш для всех событий

    async function initMonitoringTab() {
        if (monitoringInitialized) return;
        monitoringInitialized = true;

        const tableBody = document.querySelector('#monitoring-log-table tbody');
        const levelFilter = document.getElementById('log-level-filter');
        const sourceFilter = document.getElementById('log-source-filter');
        const refreshBtn = document.getElementById('refresh-monitoring-btn');

        async function loadMonitoringLogs() {
            tableBody.innerHTML = '<tr><td colspan="4">Загрузка...</td></tr>';
            try {
                const res = await apiFetch('/api/monitoring/logs');
                if (!res.ok) throw new Error('Failed to fetch logs');
                
                allMonitoringEvents = await res.json();
                renderTable();

            } catch (e) {
                tableBody.innerHTML = '<tr><td colspan="4" style="color: red;">Ошибка загрузки логов.</td></tr>';
                console.error('Error loading monitoring logs:', e);
            }
        }

        function renderTable() {
            const level = levelFilter.value;
            const source = sourceFilter.value;

            const filteredEvents = allMonitoringEvents.filter(event => {
                const levelMatch = (level === 'all') || (event.level === level);
                const sourceMatch = (source === 'all') || (event.source === source);
                return levelMatch && sourceMatch;
            });

            tableBody.innerHTML = '';
            if (filteredEvents.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4">Нет событий для отображения.</td></tr>';
                return;
            }

            filteredEvents.forEach(event => {
                const tr = document.createElement('tr');
                tr.className = `log-level-${event.level.toLowerCase()}`;
                tr.innerHTML = `
                    <td>${new Date(event.timestamp).toLocaleString()}</td>
                    <td><span class="log-level-label">${event.level}</span></td>
                    <td>${event.source}</td>
                    <td>${event.message}</td>
                `;
                tableBody.appendChild(tr);
            });
        }

        levelFilter.addEventListener('change', renderTable);
        sourceFilter.addEventListener('change', renderTable);
        refreshBtn.addEventListener('click', loadMonitoringLogs);

        loadMonitoringLogs();
    }


    // --- НАСТРОЙКИ: инициализация вкладки ---
    let settingsInitialized = false; 

    async function initSettingsTab() {
        if(settingsInitialized) return;
        settingsInitialized = true;
        
        initServerParamsSection();
        initDbSection();
        initCorsSection();
        initModersSection();
        
        settingsTab.addEventListener('click', (e) => {
            if (e.target.dataset.action === 'edit-pass') {
                const targetId = e.target.dataset.target;
                const input = document.getElementById(targetId);
                input.readOnly = false;
                input.value = '';
                input.placeholder = 'Введите новый пароль...';
                input.focus();
                e.target.remove();
            }
        });
    }

    async function initServerParamsSection() {
        // Загрузка текущих значений
        try {
            const results = await Promise.allSettled([
                apiFetch('/api/settings/admin-server'),
                apiFetch('/api/settings/backend-server')
            ]);

            const adminResult = results[0];
            if (adminResult.status === 'fulfilled') {
                const adminData = await adminResult.value.json();
            document.getElementById('admin-port').value = adminData.PORT || '';
            document.getElementById('admin-url').value = adminData.ADMIN_URL || '';
            } else {
                console.error('Failed to load admin-server settings:', adminResult.reason);
            }

            const backendResult = results[1];
            if (backendResult.status === 'fulfilled') {
                const backendData = await backendResult.value.json();
            document.getElementById('backend-host').value = backendData.host || '';
            document.getElementById('backend-port').value = backendData.port || '';
            } else {
                console.error('Failed to load backend-server settings:', backendResult.reason);
                document.getElementById('server-params-status').textContent += ' Ошибка загрузки параметров Backend.';
            }

        } catch (e) {
            document.getElementById('server-params-status').textContent = 'Критическая ошибка загрузки параметров';
            document.getElementById('server-params-status').style.color = 'red';
        }
        // Обработка сохранения
        document.getElementById('server-params-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const PORT = document.getElementById('admin-port').value;
            const ADMIN_URL = document.getElementById('admin-url').value;
            const host = document.getElementById('backend-host').value;
            const port = document.getElementById('backend-port').value;
            const statusEl = document.getElementById('server-params-status');
            statusEl.textContent = '';
            try {
                const [adminRes, backendRes] = await Promise.all([
                    apiFetch('/api/settings/admin-server', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ PORT, ADMIN_URL })
                    }),
                    apiFetch('/api/settings/backend-server', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ host, port })
                    })
                ]);
                if (adminRes.ok && backendRes.ok) {
                    statusEl.innerHTML = 'Параметры успешно сохранены.<br><strong class="warning-text">Требуется перезапуск обоих серверов для применения!</strong>';
                    statusEl.style.color = 'green';
                    showToast('Параметры успешно сохранены', 'success');
                } else {
                    statusEl.textContent = 'Ошибка сохранения';
                    statusEl.style.color = 'red';
                    showToast('Ошибка сохранения', 'error');
                }
            } catch (e) {
                statusEl.textContent = 'Ошибка сохранения';
                statusEl.style.color = 'red';
                showToast('Ошибка сохранения', 'error');
            }
        });
    }

    function initDbSection() {
        // --- БД ---
        // MS SQL
        async function loadMssql() {
            try {
                const res = await apiFetch('/api/settings/mssql');
                const data = await res.json();
                document.getElementById('mssql-user').value = data.DB_USER || '';
                
                const passWrapper = document.getElementById('mssql-pass').closest('.password-wrapper');
                passWrapper.innerHTML = `
                    <input type="password" id="mssql-pass" readonly>
                    <button type="button" class="btn-small" data-action="edit-pass" data-target="mssql-pass">Изменить</button>
                `;
                if (data.DB_PASSWORD) {
                    passWrapper.querySelector('input').placeholder = '********';
                }

                document.getElementById('mssql-server').value = data.DB_SERVER || '';
                document.getElementById('mssql-db').value = data.DB_NAME || '';
            } catch (e) {
                document.getElementById('mssql-status').textContent = 'Ошибка загрузки';
                document.getElementById('mssql-status').style.color = 'red';
            }
        }
        loadMssql();
        document.getElementById('mssql-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const payload = {
                DB_USER: document.getElementById('mssql-user').value,
                DB_SERVER: document.getElementById('mssql-server').value,
                DB_NAME: document.getElementById('mssql-db').value
            };
            const passInput = document.getElementById('mssql-pass');
            if (!passInput.readOnly) {
                payload.DB_PASSWORD = passInput.value;
            }

            const statusEl = document.getElementById('mssql-status');
            statusEl.textContent = '';
            try {
                const res = await apiFetch('/api/settings/mssql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    statusEl.innerHTML = 'Сохранено.<br><strong class="warning-text">Требуется перезапуск Admin-server для применения!</strong>';
                    statusEl.style.color = 'green';
                    showToast('Сохранено', 'success');
                    loadMssql(); // Перезагружаем секцию, чтобы сбросить поле пароля
                } else {
                    statusEl.textContent = 'Ошибка сохранения';
                    statusEl.style.color = 'red';
                    showToast('Ошибка сохранения', 'error');
                }
            } catch (e) {
                statusEl.textContent = 'Ошибка сохранения';
                statusEl.style.color = 'red';
                showToast('Ошибка сохранения', 'error');
            }
        });
        // MySQL
        async function loadMysql() {
            try {
                const res = await apiFetch('/api/settings/mysql');
                const data = await res.json();
                document.getElementById('mysql-host').value = data.MYSQL_HOST || '';
                document.getElementById('mysql-port').value = data.MYSQL_PORT || '';
                document.getElementById('mysql-user').value = data.MYSQL_USER || '';

                const passWrapper = document.getElementById('mysql-pass').closest('.password-wrapper');
                passWrapper.innerHTML = `
                    <input type="password" id="mysql-pass" readonly>
                    <button type="button" class="btn-small" data-action="edit-pass" data-target="mysql-pass">Изменить</button>
                `;
                if (data.MYSQL_PASSWORD) {
                    passWrapper.querySelector('input').placeholder = '********';
                }

                document.getElementById('mysql-db').value = data.MYSQL_DATABASE || '';
            } catch (e) {
                document.getElementById('mysql-status').textContent = 'Ошибка загрузки';
                document.getElementById('mysql-status').style.color = 'red';
            }
        }
        loadMysql();
        document.getElementById('mysql-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const payload = {
                MYSQL_HOST: document.getElementById('mysql-host').value,
                MYSQL_PORT: document.getElementById('mysql-port').value,
                MYSQL_USER: document.getElementById('mysql-user').value,
                MYSQL_DATABASE: document.getElementById('mysql-db').value
            };
            const passInput = document.getElementById('mysql-pass');
            if (!passInput.readOnly) {
                payload.MYSQL_PASSWORD = passInput.value;
            }

            const statusEl = document.getElementById('mysql-status');
            statusEl.textContent = '';
            try {
                const res = await apiFetch('/api/settings/mysql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    statusEl.innerHTML = 'Сохранено.<br><strong class="warning-text">Требуется перезапуск Admin-server для применения!</strong>';
                    statusEl.style.color = 'green';
                    showToast('Сохранено', 'success');
                    loadMysql(); // Перезагружаем секцию, чтобы сбросить поле пароля
                } else {
                    statusEl.textContent = 'Ошибка сохранения';
                    statusEl.style.color = 'red';
                    showToast('Ошибка сохранения', 'error');
                }
            } catch (e) {
                statusEl.textContent = 'Ошибка сохранения';
                statusEl.style.color = 'red';
                showToast('Ошибка сохранения', 'error');
            }
        });
    }

    function initCorsSection() {
        // --- CORS ---
        let allowedOrigins = [];
        async function loadCors() {
            const list = document.getElementById('cors-list');
            list.innerHTML = '<li>Загрузка...</li>';
            try {
                const res = await apiFetch('/api/settings/cors');
                const data = await res.json();
                allowedOrigins = Array.isArray(data.ALLOWED_ORIGINS) ? data.ALLOWED_ORIGINS : [];
                renderCorsList();
            } catch (e) {
                list.innerHTML = '<li>Ошибка загрузки</li>';
            }
        }
        const corsInput = document.getElementById('cors-new-origin');
        const corsAddBtn = document.getElementById('cors-add-btn');
        corsInput.addEventListener('input', () => {
            const val = corsInput.value.trim();
            corsAddBtn.disabled = !val || allowedOrigins.includes(val);
        });
        function renderCorsList() {
            const list = document.getElementById('cors-list');
            list.innerHTML = '';
            if (!allowedOrigins.length) {
                list.innerHTML = '<li>Нет origin</li>';
                return;
            }
            allowedOrigins.forEach((origin, idx) => {
                const li = document.createElement('li');
                li.textContent = origin + ' ';
                const delBtn = document.createElement('button');
                delBtn.textContent = 'Удалить';
                delBtn.className = 'btn-small';
                delBtn.addEventListener('click', () => {
                    allowedOrigins.splice(idx, 1);
                    renderCorsList();
                    corsAddBtn.disabled = !corsInput.value.trim() || allowedOrigins.includes(corsInput.value.trim());
                });
                li.appendChild(delBtn);
                list.appendChild(li);
            });
            corsAddBtn.disabled = !corsInput.value.trim() || allowedOrigins.includes(corsInput.value.trim());
        }
        loadCors();
        document.getElementById('cors-add-btn').addEventListener('click', () => {
            const input = document.getElementById('cors-new-origin');
            const val = input.value.trim();
            if (val && !allowedOrigins.includes(val)) {
                allowedOrigins.push(val);
                input.value = '';
                renderCorsList();
                corsAddBtn.disabled = true;
            }
        });
        document.getElementById('cors-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const statusEl = document.getElementById('cors-status');
            statusEl.textContent = '';
            try {
                const res = await apiFetch('/api/settings/cors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ALLOWED_ORIGINS: allowedOrigins })
                });
                if (res.ok) {
                    statusEl.innerHTML = 'Сохранено.<br><strong class="warning-text">Требуется перезапуск Admin-server для применения!</strong>';
                    statusEl.style.color = 'green';
                    showToast('Сохранено', 'success');
                } else {
                    statusEl.textContent = 'Ошибка сохранения';
                    statusEl.style.color = 'red';
                    showToast('Ошибка сохранения', 'error');
                }
            } catch (e) {
                statusEl.textContent = 'Ошибка сохранения';
                statusEl.style.color = 'red';
                showToast('Ошибка сохранения', 'error');
            }
        });
    }

    function initModersSection() {
        // --- МОДЕРАТОРЫ ---
        async function loadModers() {
            const tableBody = document.querySelector('#moders-table tbody');
            tableBody.innerHTML = '<tr><td colspan="3">Загрузка...</td></tr>';
            try {
                const res = await apiFetch('/api/moders');
                const moders = await res.json();
                if (!Array.isArray(moders) || !moders.length) {
                    tableBody.innerHTML = '<tr><td colspan="3">Нет модераторов</td></tr>';
                    return;
                }
                tableBody.innerHTML = '';
                for (const moder of moders) {
                    const tr = document.createElement('tr');
                    tr.dataset.id = moder.id;
                    tr.innerHTML = `<td>${moder.id}</td><td>${moder.username}</td>` +
                      `<td>` +
                        `<button class="btn-small" data-action="reset" title="Сменить пароль">🔑</button> ` +
                        `<button class="btn-small" data-action="delete" title="Удалить">🗑️</button>` +
                      `</td>`;
                    tableBody.appendChild(tr);
                }
            } catch (e) {
                tableBody.innerHTML = '<tr><td colspan="3">Ошибка загрузки</td></tr>';
            }
        }
        loadModers();
        // Добавление модератора
        document.getElementById('add-moder-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('add-moder-username').value.trim();
            const password = document.getElementById('add-moder-password').value;
            const statusEl = document.getElementById('add-moder-status');
            statusEl.textContent = '';
            if (!username || !password) {
                statusEl.textContent = 'Заполните все поля';
                statusEl.style.color = 'red';
                return;
            }
            try {
                const res = await apiFetch('/api/moders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                if (res.ok) {
                    statusEl.textContent = 'Модератор добавлен';
                    statusEl.style.color = 'green';
                    document.getElementById('add-moder-form').reset();
                    loadModers();
                    showToast('Модератор добавлен', 'success');
                } else {
                    const data = await res.json();
                    statusEl.textContent = data.message || 'Ошибка';
                    statusEl.style.color = 'red';
                    showToast(data.message || 'Ошибка', 'error');
                }
            } catch (e) {
                statusEl.textContent = 'Ошибка';
                statusEl.style.color = 'red';
                showToast('Ошибка', 'error');
            }
        });
        // Действия: удалить/сменить пароль
        document.getElementById('moders-table').addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.closest('tr').dataset.id;
            const action = btn.getAttribute('data-action');
            if (action === 'delete') {
                showConfirm('Удалить модератора?', async () => {
                try {
                    const res = await apiFetch(`/api/moders/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        loadModers();
                        showToast('Модератор удален', 'success');
                    } else {
                            showToast('Ошибка удаления', 'error');
                        }
                    } catch (e) {
                        showToast('Ошибка удаления', 'error');
                    }
                });
            } else if (action === 'reset') {
                const row = btn.closest('tr');
                const actionsCell = row.cells[2];

                // Если мы уже в режиме редактирования, ничего не делаем
                if (actionsCell.querySelector('input')) return;

                // Сохраняем оригинальные кнопки
                const originalButtons = actionsCell.innerHTML;
                
                // Создаем поле ввода и кнопки
                actionsCell.innerHTML = `
                    <input type="password" placeholder="Новый пароль" class="moder-pass-input">
                    <button class="btn-small" data-action="save-pass" title="Сохранить">✅</button>
                    <button class="btn-small" data-action="cancel-pass" title="Отмена">❌</button>
                `;

                const input = actionsCell.querySelector('input');
                input.focus();
                
                const saveBtn = actionsCell.querySelector('[data-action="save-pass"]');
                const cancelBtn = actionsCell.querySelector('[data-action="cancel-pass"]');

                const handleSave = async () => {
                    const newPass = input.value;
                    if (!newPass || newPass.length < 4) {
                        showToast('Пароль должен быть не менее 4 символов', 'error');
                        return;
                    }

                try {
                    const res = await apiFetch(`/api/moders/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password: newPass })
                    });
                    if (res.ok) {
                        showToast('Пароль обновлён', 'success');
                            actionsCell.innerHTML = originalButtons; // Возвращаем кнопки
                    } else {
                            showToast('Ошибка смены пароля', 'error');
                        }
                    } catch (e) {
                        showToast('Ошибка смены пароля', 'error');
                    }
                };

                const handleCancel = () => {
                    actionsCell.innerHTML = originalButtons;
                };
                
                saveBtn.addEventListener('click', handleSave);
                cancelBtn.addEventListener('click', handleCancel);
            }
        });
    }

    fetchStatus();
    fetchConfig();
}); 