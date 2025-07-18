import React from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';

interface PayslipViewerProps {
    fileUrl: string;
    onBack: () => void;
}

const PayslipViewer: React.FC<PayslipViewerProps> = ({ fileUrl, onBack }) => {
    const handlePrint = () => {
        const win = window.open(fileUrl, '_blank');
        if (win) {
            win.focus();
            win.print();
        }
    };

    return (
            <div className="payslip-viewer">
                <div className="top-bar">
                    <button className="back-button" onClick={onBack}>
                        ← Назад
                    </button>
                    <button className="print-button" onClick={handlePrint}>
                        🖨️ Печать
                    </button>
                </div>
                <div className="pdf-container" style={{ 
                    display: 'flex',
                    justifyContent: 'center',
                    width: '100%'
                }}>
                    <Document file={fileUrl} loading="Загрузка PDF...">
                        <div style={{ margin: '0 auto' }}>
                            <Page pageNumber={1} />
                        </div>
                    </Document>
                </div>
            </div>
                );
};

export default PayslipViewer;