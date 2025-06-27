import React, { useState } from 'react';
import './styles/main.css';
import LoginWindow from './components/LoginWindow';
import EmployeeInfo from './components/EmployeeInfo';
import GuestMode from './components/GuestMode';
import PayslipViewer from './components/PayslipViewer';

interface Employee {
    id: string;
    tnom: string;
    famaly: string;
    ima: string;
    otch: string;
    category: string;
    organization: string;
    identNumber: string;
}

function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isGuestMode, setIsGuestMode] = useState(false);
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [showPayslip, setShowPayslip] = useState(false);
    const [loginError, setLoginError] = useState('');

    const handleLogin = async (id: string) => {
        try {
            const response = await fetch(`http://localhost:3001/api/employee/${id}`);
            if (response.ok) {
                const data = await response.json();
                setEmployee(data);
                setIsLoggedIn(true);
                setLoginError('');
            } else {
                setLoginError('Сотрудник не найден');
            }
        } catch (error) {
            console.error('Error:', error);
            setLoginError('Ошибка при получении данных');
        }
    };

    const handleGuestMode = () => {
        setIsGuestMode(true);
    };

    const handleBack = () => {
        setIsLoggedIn(false);
        setEmployee(null);
        setIsGuestMode(false);
        setShowPayslip(false);
    };

    const handleViewPayslip = () => {
        setShowPayslip(true);
    };

    const handlePrintPayslip = () => {
        setShowPayslip(true);
    };

    const handlePayslipBack = () => {
        setShowPayslip(false);
    };

    return (
        <div className="app">
            {!isLoggedIn && !isGuestMode ? (
                <LoginWindow onLogin={handleLogin} onGuestMode={handleGuestMode} loginError={loginError} />
            ) : isGuestMode ? (
                <GuestMode onBack={handleBack} />
            ) : showPayslip ? (
                <PayslipViewer
                    fileUrl="/payslips/test.pdf"
                    onBack={handlePayslipBack}
                />
            ) : employee ? (
                <EmployeeInfo
                    employee={employee}
                    onViewPayslip={handleViewPayslip}
                    onPrintPayslip={handlePrintPayslip}
                    onBack={handleBack}
                />
            ) : null}
        </div>
    );
}

export default App;
