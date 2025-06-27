import React from 'react';

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

interface EmployeeInfoProps {
    employee: Employee;
    onViewPayslip: () => void;
    onPrintPayslip: () => void;
    onBack: () => void;
}

const EmployeeInfo: React.FC<EmployeeInfoProps> = ({
    employee,
    onViewPayslip,
    onPrintPayslip,
    onBack
}) => {
    return (
        <div className="employee-info">
            <div className="top-bar">
                <button className="back-button" onClick={onBack}>
                    ← Назад
                </button>
            </div>
            
            <div className="employee-header">
                <div className="employee-photo">
                    {/* Заглушка для фото */}
                    <div className="photo-placeholder">Фото</div>
                </div>
                <div className="employee-details">
                    <h2>{`${employee.famaly} ${employee.ima} ${employee.otch}`}</h2>
                    <p>Табельный номер: {employee.tnom}</p>
                    <p>Категория: {employee.category}</p>
                    <p>Организация: {employee.organization}</p>
                </div>
            </div>
            
            <div className="action-buttons">
                <button onClick={onViewPayslip}>
                    Просмотр расчетного листа
                </button>
                <button onClick={onPrintPayslip}>
                    Печать расчетного листа
                </button>
            </div>
        </div>
    );
};

export default EmployeeInfo; 