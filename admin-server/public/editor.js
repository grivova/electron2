document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const editorSection = document.getElementById('editor-section');
    const loginForm = document.getElementById('moder-login-form');
    const loginError = document.getElementById('login-error');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const addBlockBtn = document.getElementById('add-block-btn');
    const blocksList = document.getElementById('blocks-list');
    const logoutBtn = document.getElementById('logout-btn');
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        const username = loginForm.username.value.trim();
        const password = loginForm.password.value;
        try {
            const res = await fetch('/moders/moder-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (res.ok) {
                loginSection.style.display = 'none';
                editorSection.style.display = '';
                loadBlocks(currentTab);
            } else {
                const data = await res.json();
                loginError.textContent = data.message || 'Ошибка входа';
            }
        } catch (err) {
            loginError.textContent = 'Ошибка сервера';
        }
    });
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await fetch('/moders/moder-logout');
            editorSection.style.display = 'none';
            loginSection.style.display = '';
            showNotify('Вы вышли из системы', 'success');
        };
    }
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            loadBlocks(currentTab);
        });
    });
    function loadBlocks(tab) {
        fetch(`/moders/content/${tab}`)
            .then(res => res.json())
            .then(data => {
                blocksList.innerHTML = '';
                if (!Array.isArray(data) || !data.length) {
                    blocksList.innerHTML = '<p>Нет блоков</p>';
                    return;
                }
                data.forEach(block => {
                    const div = document.createElement('div');
                    div.className = 'content-block';
                    div.innerHTML = `<div class="block-preview" style="margin-bottom:10px;">${DOMPurify.sanitize(block.content)}</div>`;
                    const editBtn = document.createElement('button');
                    editBtn.textContent = 'Редактировать';
                    editBtn.onclick = () => openEditModal(block);
                    const delBtn = document.createElement('button');
                    delBtn.textContent = 'Удалить';
                    delBtn.onclick = async () => {
                        if (confirm('Удалить блок?')) {
                            await fetch(`/moders/content/${tab}/${block.id}`, { method: 'DELETE' });
                            showNotify('Блок удалён', 'success');
                            loadBlocks(tab);
                        }
                    };
                    div.appendChild(editBtn);
                    div.appendChild(delBtn);
                    blocksList.appendChild(div);
                });
            });
    }
    const editModal = document.getElementById('edit-modal');
    const editModalClose = document.getElementById('edit-modal-close');
    const editBlockForm = document.getElementById('edit-block-form');
    const editBlockId = document.getElementById('edit-block-id');
    const editModalTitle = document.getElementById('edit-modal-title');
    let editQuill;
    let currentTab = 'info';
    let editingBlockId = null;
    let originalContent = '';
    function showNotify(msg, type = 'success') {
        const notify = document.getElementById('notify');
        notify.textContent = msg;
        notify.className = 'show ' + type;
        setTimeout(() => { notify.className = ''; }, 2200);
    }
    editQuill = new Quill('#edit-quill-editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ header: [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'align': [] }],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['blockquote', 'code-block'],
                ['link', 'image', 'video'],
                ['clean']
            ]
        }
    });
    function openEditModal(block) {
        editingBlockId = block ? block.id : null;
        editBlockId.value = block ? block.id : '';
        editModalTitle.textContent = block ? 'Редактировать блок' : 'Добавить блок';
        editQuill.root.innerHTML = block ? block.content : '';
        document.getElementById('edit-block-preview').innerHTML = block ? DOMPurify.sanitize(block.content) : '';
        originalContent = block ? block.content : '';
        editModal.style.display = 'block';
    }
    editQuill.on('text-change', () => {
        document.getElementById('edit-block-preview').innerHTML = DOMPurify.sanitize(editQuill.root.innerHTML);
    });
    function tryCloseEditModal() {
        const currentContent = editQuill.root.innerHTML;
        if (currentContent !== originalContent) {
            document.getElementById('confirm-modal').style.display = 'flex';
            const yesBtn = document.getElementById('confirm-close-yes');
            const noBtn = document.getElementById('confirm-close-no');
            yesBtn.onclick = function() {
                document.getElementById('confirm-modal').style.display = 'none';
                editModal.style.display = 'none';
            };
            noBtn.onclick = function() {
                document.getElementById('confirm-modal').style.display = 'none';
            };
            return;
        }
        editModal.style.display = 'none';
    }
    editModalClose.onclick = tryCloseEditModal;
    window.onclick = (event) => {
        if (event.target === editModal) tryCloseEditModal();
    };
    addBlockBtn.onclick = () => openEditModal(null);
    editBlockForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = DOMPurify.sanitize(editQuill.root.innerHTML.trim());
        if (!content || content === '<p><br></p>') return;
        if (editingBlockId) {
            await fetch(`/moders/content/${currentTab}/${editingBlockId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'text', content })
            });
            showNotify('Блок обновлён', 'success');
        } else {
            await fetch(`/moders/content/${currentTab}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'text', content })
            });
            showNotify('Блок добавлен', 'success');
        }
        editModal.style.display = 'none';
        loadBlocks(currentTab);
    });
    fetch('/moders/check-session').then(res => {
        if (res.ok) {
            loginSection.style.display = 'none';
            editorSection.style.display = '';
            loadBlocks(currentTab);
        } else {
            loginSection.style.display = '';
            editorSection.style.display = 'none';
        }
    });

    let csrfToken = '';
    fetch('/moders/csrf-token').then(res => res.json()).then(data => {
        csrfToken = data.csrfToken;
    });

    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        if (options && options.method && ['POST','PUT','DELETE'].includes(options.method.toUpperCase())) {
            options.headers = options.headers || {};
            options.headers['x-csrf-token'] = csrfToken;
        }
        return originalFetch(url, options);
    };
}); 