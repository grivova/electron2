import React, { useState, useEffect } from 'react';
import config from "../../src/config.json";
interface GuestModeProps {
    onBack: () => void;
}

function parseHandbookBlocks(html: string) {
    const blocks: (string | { type: 'phones', rows: { desc: string, internal: string, city: string }[] })[] = [];
    const container = document.createElement('div');
    container.innerHTML = html;
    let phoneRows: { desc: string, internal: string, city: string }[] = [];
    let lastDesc = '';
    const phoneRegex = /(\d{2,3}-\d{2,3}(?:-\d{2,3})?|\d{4}\s\d{6,7})/g;
    const children = Array.from(container.childNodes);
    let htmlBuffer = '';
    const flushHtmlBuffer = () => {
        if (htmlBuffer) {
            blocks.push(htmlBuffer);
            htmlBuffer = '';
        }
    };
    const flushPhoneRows = () => {
        if (phoneRows.length > 1) {
            blocks.push({ type: 'phones', rows: phoneRows });
        } else if (phoneRows.length === 1) {
            const row = phoneRows[0];
            blocks.push(`<p>${row.desc} ${row.internal}${row.city ? ' ' + row.city : ''}</p>`);
        }
        phoneRows = [];
    };
    children.forEach(node => {
        if (node.nodeType === 1) {
            const tag = (node as HTMLElement).tagName.toLowerCase();
            const text = (node as HTMLElement).textContent?.trim() || '';
            const phones = Array.from(text.matchAll(phoneRegex), m => m[1]);
            if ((tag === 'p' || tag === 'li') && phones.length >= 1) {
                flushHtmlBuffer();
                if (phones.length === 2) {
                    const desc = text.replace(phoneRegex, '').trim();
                    phoneRows.push({ desc, internal: phones[0], city: phones[1] });
                    lastDesc = desc;
                } else if (phones.length === 1) {
                    phoneRows.push({ desc: lastDesc, internal: phones[0], city: '' });
                } else if (text && !phones.length) {
                    lastDesc = text;
                }
            } else {
                if (phoneRows.length) {
                    flushPhoneRows();
                }
                if ((node as HTMLElement).outerHTML) {
                    htmlBuffer += (node as HTMLElement).outerHTML;
                } else {
                    htmlBuffer += node.textContent || '';
                }
            }
        } else if (node.nodeType === 3) { 
            htmlBuffer += node.textContent;
        }
    });
    if (phoneRows.length) {
        flushPhoneRows();
    }
    if (htmlBuffer) {
        blocks.push(htmlBuffer);
    }
    return blocks;
}

const HandbookBlocks: React.FC<{ html: string }> = ({ html }) => {
    const [blocks, setBlocks] = useState<(string | { type: 'phones', rows: { desc: string, internal: string, city: string }[] })[]>([]);
    useEffect(() => {
        setBlocks(parseHandbookBlocks(html));
    }, [html]);
    return (
        <>
            {blocks.map((block, i) => {
                if (typeof block === 'string') {
                    return <div key={i} dangerouslySetInnerHTML={{ __html: block }} />;
                } else if (block.type === 'phones') {
                    return (
                        <table className="handbook-table" key={i} style={{ margin: '24px auto' }}>
                            <thead>
                                <tr>
                                    <th>Описание</th>
                                    <th>АТС предприятия</th>
                                    <th>Городская АТС</th>
                                </tr>
                            </thead>
                            <tbody>
                                {block.rows.map((row, j) => (
                                    <tr key={j}>
                                        <td>{row.desc}</td>
                                        <td>{row.internal}</td>
                                        <td>{row.city}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    );
                }
                return null;
            })}
        </>
    );
};

const ADMIN_SERVER_URL = config.adminServerUrl;

function patchMediaSrc(html: string): string {
    return html
        .replace(/<img([^>]+)src=["'](\/uploads\/[^"']+)["']/g, `<img$1src="${ADMIN_SERVER_URL}$2"`)
        .replace(/<video([^>]+)src=["'](\/uploads\/[^"']+)["']/g, `<video$1src="${ADMIN_SERVER_URL}$2"`);
}

const renderContentBlocks = (blocks: any[]) => (
    <>
        {blocks.map((block, i) => (
            <div key={block.id || i} style={{marginBottom: 16}} dangerouslySetInnerHTML={{ __html: patchMediaSrc(block.content) }} />
        ))}
    </>
);

const GuestMode: React.FC<GuestModeProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState<'handbook' | 'union' | 'info'>('handbook');
    const [handbookContent, setHandbookContent] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [infoBlocks, setInfoBlocks] = useState<any[]>([]);
    const [unionBlocks, setUnionBlocks] = useState<any[]>([]);

    useEffect(() => {
        if (activeTab === 'handbook') {
            loadHandbook();
        } else if (activeTab === 'info') {
            loadInfoBlocks();
        } else if (activeTab === 'union') {
            loadUnionBlocks();
        }
        // eslint-disable-next-line
    }, [activeTab]);

    const loadHandbook = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${config.backendUrl}/api/handbook/html`);
            const html = await response.text();
            setHandbookContent(html);
        } catch (error) {
            setHandbookContent('Ошибка загрузки справочника');
        }
        setLoading(false);
    };

    const loadInfoBlocks = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${ADMIN_SERVER_URL}/moders/content/info`);
            const data = await res.json();
            setInfoBlocks(Array.isArray(data) ? data : []);
        } catch (e) {
            setInfoBlocks([]);
        }
        setLoading(false);
    };

    const loadUnionBlocks = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${ADMIN_SERVER_URL}/moders/content/union`);
            const data = await res.json();
            setUnionBlocks(Array.isArray(data) ? data : []);
        } catch (e) {
            setUnionBlocks([]);
        }
        setLoading(false);
    };

    return (
        <div className="guest-mode">
            <div className="top-bar">
                <button className="back-button" onClick={onBack}>
                    ← Назад
                </button>
            </div>
            <div className="guest-content">
                <h2>Гостевой режим</h2>
                <div className="tab-navigation">
                    <button 
                        className={`tab-button ${activeTab === 'handbook' ? 'active' : ''}`}
                        onClick={() => setActiveTab('handbook')}
                    >
                        Справочник
                    </button>
                    <button 
                        className={`tab-button ${activeTab === 'union' ? 'active' : ''}`}
                        onClick={() => setActiveTab('union')}
                    >
                        Профсоюз
                    </button>
                    <button 
                        className={`tab-button ${activeTab === 'info' ? 'active' : ''}`}
                        onClick={() => setActiveTab('info')}
                    >
                        Общая информация
                    </button>
                </div>
                <div className="tab-content">
                    {activeTab === 'handbook' && (
                        <div className="handbook-content">
                            {loading ? (
                                <div className="loading">Загрузка справочника...</div>
                            ) : (
                                <HandbookBlocks html={handbookContent} />
                            )}
                        </div>
                    )}
                    {activeTab === 'union' && (
                        <div className="union-content">
                            {loading ? (
                                <div className="loading">Загрузка...</div>
                            ) : (
                                unionBlocks.length ? renderContentBlocks(unionBlocks) : <p>Нет информации о профсоюзе.</p>
                            )}
                        </div>
                    )}
                    {activeTab === 'info' && (
                        <div className="info-content">
                            {loading ? (
                                <div className="loading">Загрузка...</div>
                            ) : (
                                infoBlocks.length ? renderContentBlocks(infoBlocks) : <p>Нет общей информации.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GuestMode; 