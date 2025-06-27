import React, { useEffect, useRef, useState } from 'react';

interface LoginWindowProps {
    onLogin: (id: string) => void;
    onGuestMode: () => void;
    loginError?: string;
}

const LoginWindow: React.FC<LoginWindowProps> = ({ onLogin, onGuestMode, loginError }) => {
    const [id, setId] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const setupCardListener = () => {
            console.log('[LoginWindow] Setting up card listener...');
            const handleCardDetected = (uid: string) => {
                console.log('Card detected in renderer via preload:', uid);
                onLogin(uid);
            };
            
            window.electronAPI.onCardDetected(handleCardDetected);
        };

        // Если API уже доступно (например, при hot-reload), используем его сразу.
        if (window.electronAPI) {
            setupCardListener();
        } else {
            // Иначе, ждем специального события от preload.js
            console.log('[LoginWindow] electronAPI not ready, waiting for event...');
            window.addEventListener('electronApiReady', setupCardListener, { once: true });
        }

        // Очистка при размонтировании компонента
        return () => {
            console.log('[LoginWindow] Cleaning up listeners.');
            window.removeEventListener('electronApiReady', setupCardListener);
            // Убеждаемся, что API существует перед тем, как вызывать его
            if (window.electronAPI) {
                window.electronAPI.removeCardDetectedListeners();
            }
        };
    }, [onLogin]);

    useEffect(() => {
        if (loginError) {
            setId('');
            inputRef.current?.focus();
        }
    }, [loginError]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (id.trim()) {
            onLogin(id.trim());
        }
    };

    return (
        <div className="login-window">
            <h2>Вход в систему</h2>
            <div className="card-prompt">
                <p>Пожалуйста, приложите вашу карту к считывателю</p>
                <div className="card-icon">💳</div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="input-group">
                    <label htmlFor="id">или введите ID сотрудника:</label>
                    <input
                        ref={inputRef}
                        type="text"
                        id="id"
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                        placeholder="ID сотрудника"
                    />
                </div>
                {loginError && <div className="error" style={{ color: 'red', marginTop: 8 }}>{loginError}</div>}
                <div className="button-group">
                    <button type="submit" disabled={!id.trim()}>
                        Войти
                    </button>
                    <button type="button" onClick={onGuestMode}>
                        Гостевой режим
                    </button>
                </div>
            </form>
        </div>
    );
};

export default LoginWindow; 