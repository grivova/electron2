const WebSocket = require('ws');
const iconv = require('iconv-lite');
const { spawn } = require('child_process');
const logger = require('../logger');

function setupWebSocket(server) {
    const wss = new WebSocket.Server({ server });
    
    wss.on('connection', (ws) => {
        logger.info('New WebSocket connection');
        
        let pingProcess = null;

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                
                if (data.type === 'ping') {
                    const ip = data.ip;
                    
                    // Валидация IP
                    if (!ip || !/^[a-zA-Z0-9\.\-_:]+$/.test(ip)) {
                        ws.send(JSON.stringify({ 
                            type: 'error', 
                            message: 'Invalid IP address format' 
                        }));
                        return;
                    }

                    // Завершаем предыдущий процесс, если есть
                    if (pingProcess) {
                        pingProcess.kill();
                    }

                    // Запускаем ping (для Windows)
                    pingProcess = spawn('ping', ['-t', ip]);
                    
                    // Обработка вывода
                    pingProcess.stdout.on('data', (data) => {
                        const decodedData = iconv.decode(data, 'cp866');
                        ws.send(JSON.stringify({ 
                            type: 'data', 
                            data: decodedData 
                        }));
                    });

                    pingProcess.stderr.on('data', (data) => {
                        const decodedData = iconv.decode(data, 'cp866');
                        ws.send(JSON.stringify({ 
                            type: 'error', 
                            data: decodedData 
                        }));
                    });

                    pingProcess.on('close', (code) => {
                        ws.send(JSON.stringify({ 
                            type: 'close', 
                            data: `Process exited with code ${code}` 
                        }));
                        pingProcess = null;
                    });
                }
            } catch (e) {
                logger.error('WebSocket message error:', e);
                ws.send(JSON.stringify({ 
                    type: 'error', 
                    message: 'Invalid message format',
                    details: e.message 
                }));
            }
        });

        ws.on('close', () => {
            logger.info('WebSocket connection closed');
            if (pingProcess) {
                pingProcess.kill();
                pingProcess = null;
            }
        });

        ws.on('error', (error) => {
            logger.error('WebSocket error:', error);
            if (pingProcess) {
                pingProcess.kill();
                pingProcess = null;
            }
        });
    });

    return wss;
}

module.exports = setupWebSocket;