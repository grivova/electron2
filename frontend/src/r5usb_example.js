const ref = require('ref-napi');
const Struct = require('ref-struct-napi');
const {
  E_RG_ENDPOINT_TYPE,
  E_RG_DEVICE_EVENT_TYPE,
  E_API_ERROR_CODES,
  RG_ENDPOINT,
  RG_ENDPOINT_INFO,
  RG_CARD_INFO,
  RG_DEVICE_INFO_EXT,
  rgsec,
  errorToString
} = require('./r5usb');
const axios = require('axios');

function readCString(buffer, size) {
  const bytes = [];
  for (let i = 0; i < size; i++) {
    const byte = buffer.readUInt8(i);
    if (byte === 0) break;
    bytes.push(byte);
  }
  return Buffer.from(bytes).toString('utf8');
}

async function main() {
  console.log('Старт программы');
  const initRes = rgsec.RG_InitializeLib();
  console.log('После RG_InitializeLib, код:', initRes);
  if (initRes !== E_API_ERROR_CODES.EC_OK) {
    console.error('RG_InitializeLib failed:', errorToString(initRes));
    return;
  }

  try {
    console.log('Поиск устройств...');
    const endpointListPtr = ref.alloc('pointer');
    const countPtr = ref.alloc('uint32');
    const findRes = rgsec.RG_FindEndPoints(
      endpointListPtr,
      E_RG_ENDPOINT_TYPE.ET_USBHID,
      countPtr
    );
    console.log('После RG_FindEndPoints, код:', findRes);
    
    if (findRes !== E_API_ERROR_CODES.EC_OK) {
      throw new Error(`RG_FindEndPoints failed: ${errorToString(findRes)}`);
    }

    const count = countPtr.deref();
    console.log('Найдено устройств:', count);
    if (count === 0) {
      throw new Error('USB HID не найден');
    }
    const endpointInfo = new RG_ENDPOINT_INFO();
    const infoRes = rgsec.RG_GetFoundEndPointInfo(
      endpointListPtr.deref(),
      0,
      endpointInfo.ref()
    );
    console.log('После RG_GetFoundEndPointInfo, код:', infoRes);
    
    if (infoRes !== E_API_ERROR_CODES.EC_OK) {
      throw new Error(`RG_GetFoundEndPointInfo failed: ${errorToString(infoRes)}`);
    }

    const endpoint = new RG_ENDPOINT();
    endpoint.type = endpointInfo.type;
    endpoint.address = readCString(
      endpointInfo.address.buffer, 
      endpointInfo.address.length
    );
    console.log('Endpoint type:', endpoint.type);
    console.log('Endpoint address:', endpoint.address);

    const address = 0; 

    const initDevRes = rgsec.RG_InitDevice(endpoint.ref(), address);
    console.log('После RG_InitDevice, код:', initDevRes);7301546
    
    if (initDevRes !== E_API_ERROR_CODES.EC_OK) {
      throw new Error(`RG_InitDevice failed: ${errorToString(initDevRes)}`);
    }

    console.log('инициализация прошла успешно');
    const deviceInfoExt = new RG_DEVICE_INFO_EXT();
    const infoExtRes = rgsec.RG_GetInfoExt(
      endpoint.ref(),
      address,
      deviceInfoExt.ref()
    );
    console.log('После RG_GetInfoExt, код:', infoExtRes);
    
    if (infoExtRes === E_API_ERROR_CODES.EC_OK) {
      console.log('номер:', deviceInfoExt.serial.toString(16));
      console.log('прошивка:', deviceInfoExt.firmware.toString(16));
    } else {
      console.warn('Не удалось получить расширенную информацию об устройстве');
    }

    const queuePtr = ref.alloc('pointer');
    console.log('Подписка на события...');
    const subscribeRes = rgsec.RG_Subscribe(
      queuePtr,
      endpoint.ref(),
      address,
      E_RG_DEVICE_EVENT_TYPE.DET_CARD_PLACED_EVENT |
      E_RG_DEVICE_EVENT_TYPE.DET_CARD_REMOVED_EVENT,
      ref.NULL
    );
    console.log('После RG_Subscribe, код:', subscribeRes);
    
    if (subscribeRes !== E_API_ERROR_CODES.EC_OK) {
      throw new Error(`RG_Subscribe failed: ${errorToString(subscribeRes)}`);
    }

    const eventQueue = queuePtr.deref();
    console.log('Ожидание событий...');
    const eventTypePtr = ref.alloc('uint32');
    const eventDataPtrPtr = ref.alloc('pointer');
    
    const pollEvents = () => {
      const pollRes = rgsec.RG_PollEvents(
        eventQueue,
        eventTypePtr,
        eventDataPtrPtr,
        1000
      );
      console.log('PollEvents, код:', pollRes);

      switch (pollRes) {
        case E_API_ERROR_CODES.EC_OK:
          handleEvent(eventTypePtr.deref(), eventDataPtrPtr.deref());
          setImmediate(pollEvents);
          break;
        
        case E_API_ERROR_CODES.EC_POLL_NO_EVENTS:
          setImmediate(pollEvents);
          break;
        
        default:
          console.error('Ошибка PollEvents:', errorToString(pollRes));
          cleanup();
          process.exit(1);
      }
    };

    const handleEvent = (eventType, eventDataPtr) => {
      console.log('handleEvent, тип события:', eventType);
      switch (eventType) {
        case E_RG_DEVICE_EVENT_TYPE.DET_CARD_PLACED_EVENT:
          const cardInfo = ref.reinterpret(eventDataPtr, RG_CARD_INFO.size).deref();
          const uid = Array.from(cardInfo.uid).map(b => b.toString(16).padStart(2, '0'));
          console.log(`Карта обнаружена: ${uid.join(':')}`);
          // Логгируем в admin-server
          console.log('[DEBUG] Отправляю событие на admin-server:', { event, uid, timestamp });
          axios.post('http://localhost:3005/api/card-event', {
            event: 'CARD_PLACED',
            uid: uid.join(''),
            timestamp: Date.now()
          }).catch(err => {
            console.error('[ADMIN][CARD_LOG] Ошибка отправки:', err.message);
          });
          break;
          
        case E_RG_DEVICE_EVENT_TYPE.DET_CARD_REMOVED_EVENT:
          console.log('Карта удалена');
          // Логгируем в admin-server
          console.log('[DEBUG] Отправляю событие на admin-server:', { event, uid, timestamp });
          axios.post('http://localhost:3005/api/card-event', {
            event: 'CARD_REMOVED',
            uid: null,
            timestamp: Date.now()
          }).catch(err => {
            console.error('[ADMIN][CARD_LOG] Ошибка отправки:', err.message);
          });
          break;
          
        default:
          console.log(`Необработанное событие: ${eventType}`);
      }
    };
    pollEvents();

  } catch (err) {
    console.error('Ошибка:', err.message);
    cleanup();
  }

  process.on('SIGINT', () => {
    console.log('\nЗавершение работы...');
    cleanup();
    process.exit(0);
  });

  function cleanup() {
    try {
      console.log('Очистка ресурсов...');
      rgsec.RG_CloseResource(endpointListPtr?.deref());
      rgsec.RG_CloseDevice(endpoint?.ref(), address);
      rgsec.RG_Uninitialize();
      console.log('Ресурсы освобождены.');
    } catch (cleanupErr) {
      console.error('Ошибка при очистке:', cleanupErr.message);
    }
  }
}

main();