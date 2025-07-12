import React, { useState } from 'react';

interface Employee {
    id: string;
    cardNumber?: string;
    tnom: string;
    famaly: string;
    ima: string;
    otch: string;
    profession?: string;
    category?: string;
    departmentName?: string;
    organization: string;
}

interface EmployeeInfoProps {
    employee: Employee;
    onViewPayslip: (period: string) => void;
    onBack: () => void;
}

const EmployeeInfo: React.FC<EmployeeInfoProps> = ({
    employee,
    onViewPayslip,
    onBack
}) => {
    const [selectedPeriod, setSelectedPeriod] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${month}${year}`;
    });

    // Генерируем список периодов за последние 12 месяцев
    const generatePeriods = () => {
        const periods = [];
        const now = new Date();
        
        for (let i = 0; i < 12; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            periods.push(`${month}${year}`);
        }
        
        return periods;
    };

    const periods = generatePeriods();
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                       'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

    return (
        <div className="employee-info">
            <div className="top-bar">
                <button className="back-button" onClick={onBack}>
                    ← Назад
                </button>
            </div>
            
            <div className="employee-header">
                <div className="employee-photo">
                    <div className="photo-placeholder">Фото</div>
                </div>
                <div className="employee-details">
                    <h2>{`${employee.famaly} ${employee.ima} ${employee.otch}`}</h2>
                    <p>Табельный номер: {employee.tnom}</p>
                    {employee.category?.trim() && <p>Категория: {employee.category}</p>}
                    {employee.departmentName && (
                        <p>Подразделение: {employee.departmentName}</p>
                    )}
                    <p>Организация: {employee.organization}</p>
                    {employee.profession && <p>Профессия: {employee.profession}</p>}
                </div>
            </div>
            
            <div className="payslip-section">
                <h3>Расчётный лист</h3>
                <div className="period-selector">
                    <label htmlFor="period-select">Выберите период:</label>
                    <select 
                        id="period-select"
                        value={selectedPeriod} 
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                    >
                        {periods.map(period => (
                            <option key={period} value={period}>
                                {monthNames[parseInt(period.substring(0, 2)) - 1]} {period.substring(2)}
                            </option>
                        ))}
                    </select>
                </div>
                
                <button onClick={() => onViewPayslip(selectedPeriod)}>
                    Посмотреть расчётный лист
                </button>
            </div>
        </div>
    );
};

export default EmployeeInfo;