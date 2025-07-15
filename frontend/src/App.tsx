import React, { useState } from 'react';
import './styles/main.css';
import LoginWindow from './components/LoginWindow';
import EmployeeInfo from './components/EmployeeInfo';
import GuestMode from './components/GuestMode';
import PayslipViewer from './components/PayslipViewer';
import config from './config.json';

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
    const [selectedPeriod, setSelectedPeriod] = useState('');
    const [loginError, setLoginError] = useState('');

    const handleLogin = async (id: string) => {
        try {
            const isCardUid = /^\d{7}$/.test(id);
            const url = isCardUid
                ? `${config.backendUrl}/api/employee/card/${id}`
                : `${config.backendUrl}/api/employee/${id}`;
            const response = await fetch(url);
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
        setSelectedPeriod('');
    };

    const handleViewPayslip = (period: string) => {
        setSelectedPeriod(period);
        setShowPayslip(true);
    };

    const handlePayslipBack = () => {
        setShowPayslip(false);
        setSelectedPeriod('');
    };

    const getPayslipUrl = (employee: Employee, period: string) => {
        const fileName = `${employee.tnom}.pdf`;

        return `${config.backendUrl}/api/payslip/${period}/${fileName}`;
    };

    return (
        <div className="app">
            {!isLoggedIn && !isGuestMode ? (
                <LoginWindow onLogin={handleLogin} onGuestMode={handleGuestMode} loginError={loginError} />
            ) : isGuestMode ? (
                <GuestMode onBack={handleBack} />
            ) : showPayslip ? (
                <PayslipViewer
                    fileUrl={employee && selectedPeriod ? getPayslipUrl(employee, selectedPeriod) : "/payslips/test.pdf"}
                    onBack={handlePayslipBack}
                />
            ) : employee ? (
                <EmployeeInfo
                    employee={employee}
                    onViewPayslip={handleViewPayslip}
                    onBack={handleBack}
                />
            ) : null}
        </div>
    );
}

export default App;
