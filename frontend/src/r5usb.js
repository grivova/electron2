const ffi = require('ffi-napi');
const ref = require('ref-napi');
const Struct = require('ref-struct-napi');
const ArrayType = require('ref-array-napi');


const E_RG_ENDPOINT_TYPE = {
  ET_UNKNOWN: 0,
  ET_USBHID: 1,
  ET_SERIAL: 2
};
const E_RG_STATUS_TYPE = {
  STE_UNKNOWN: 0,
  STE_NO_CARD: 1,
  STE_CARD: 9,
  STE_CARD_NO_AUTH: 10,
  STE_CARD_AUTH: 26
};
const E_RG_CARD_FAMILY_CODE = {
  CF_PIN: 1,
  CF_TEMIC: 2,
  CF_HID: 4,
  CF_EM: 8,
  CF_INDALA: 16,
  CF_COTAG: 32,
  CF_MIFARE: 64,
  CF_INDALA_MT: 128,
  CF_ALL: 255
};
const RG_CARD_AUTH_PARAMS = Struct({
  flags: 'uint8',
  classicKey: ArrayType('uint8', 6),
  plusKey: ArrayType('uint8', 16)
});

const RG_CARD_MEMORY = Struct({
  profile_block: 'uint8',
  block_data: ArrayType('uint8', 16)
});
const E_API_ERROR_CODES = {
  EC_OK: 0,
  EC_FAIL: 1,
  EC_NOT_IMPLEMENTED: 2,
  EC_BAD_ARGUMENT: 3,
  EC_INVALID_HANDLE: 4,
  EC_INVALID_RESOURCE: 5,
  EC_INVALID_CONNECTION_TYPE: 6,
  EC_INVALID_CONNECTION_ADDRESS: 7,
  EC_INVALID_DEVICE_ADDRESS: 8,
  EC_DEVICE_OPERATION_UNSUPPORTED: 9,
  EC_DEVICE_NOT_CONNECTED: 10,
  EC_DEVICE_NO_RESPOND: 11,
  EC_DEVICE_COMM_FAILURE: 12,
  EC_DEVICE_PROTOCOL_FAILURE: 13,
  EC_POLL_NO_EVENTS: 14,
  EC_POLL_QUEUE_CLOSED: 15,
  EC_CALL_INIT: 16,
  EC_DEVICE_INVALID_COMMAND: 17,
  EC_DEVICE_INVALID_PARAM: 18,
  EC_DEVICE_INVALID_PIN: 19,
  EC_DEVICE_COMMAND_TIMEOUT: 20,
  EC_DEVICE_NO_CARD: 21,
  EC_DEVICE_UOWN_CARD: 22,
  EC_DEVICE_INCOMPATIBLE_CARD: 23,
  EC_DEVICE_AUTH_FAIL: 24,
  EC_DEVICE_PROFILE_FAIL: 25,
  EC_DEVICE_RW_FAIL: 26,
  EC_IO_OPEN_FAIL: 27,
  EC_IO_CLOSE_FAIL: 28,
  EC_IO_READ_FAIL: 29,
  EC_IO_WRITE_FAIL: 30,
  EC_IO_CLOSED: 31,
  EC_DEVICE_IN_BOOT: 32,
  EC_DEVICE_FW_INVALID_MODEL: 33,
  EC_FILE_NOT_FOUND: 34,
  EC_FINGERPRINT_UNFOUND: 35
};

const E_RG_DEVICE_EVENT_TYPE = {
  DET_UNKNOWN_EVENT: 0,
  DET_CARD_PLACED_EVENT: 2,
  DET_CARD_REMOVED_EVENT: 4,
  DET_RELAY_STATE_CHANGED: 8,
  DET_TAMPER_STATE_CHANGED: 16,
  DET_BUTTON_STATE_CHANGED: 32,
  DET_DOOR_SENSOR_STATE_CHANGED: 64,
  DET_POLL_ERROR: 128
};

// Структуры
const RG_ENDPOINT = Struct({
  type: 'uint8',
  address: 'string' // const char*
});
const RG_CARD_INFO = Struct({
  type: 'uint8',
  uid: ArrayType('uint8', 7)
});
const RG_ENDPOINT_INFO = Struct({
  type: 'uint8',
  address: ArrayType('char', 64),
  friendly_name: ArrayType('char', 128)
});
const RG_DEVICE_INFO_EXT = Struct({
  address: 'uint8',
  serial: 'uint32',
  firmwareUpdateLock: 'uint8',
  type: 'uint8',
  firmware: 'uint16',
  capabilities: 'uint32'
});

// DLL
const rgsec = ffi.Library('librgsec.dll', {
  'RG_InitializeLib': ['uint32', []],
  'RG_Uninitialize': ['uint32', []],
  'RG_FindEndPoints': ['uint32', ['pointer', 'uint8', 'pointer']],
  'RG_GetFoundEndPointInfo': ['uint32', ['pointer', 'uint32', 'pointer']],
  'RG_InitDevice': ['uint32', [ref.refType(RG_ENDPOINT), 'uint8']],
  'RG_SetCardsMask': ['uint32', [ref.refType(RG_ENDPOINT), 'uint8', 'uint8']],
  'RG_GetStatus': ['uint32', [ref.refType(RG_ENDPOINT), 'uint8', 'pointer', 'pointer', ref.refType(RG_CARD_INFO), 'pointer']],
  'RG_CloseResource': ['uint32', ['pointer']],
  'RG_WriteProfile': ['uint32', [ref.refType(RG_ENDPOINT), 'uint8', 'uint8', 'uint8', ref.refType(RG_CARD_AUTH_PARAMS)]],
  'RG_ReadBlockDirect': ['uint32', [ref.refType(RG_ENDPOINT), 'uint8', ref.refType(RG_CARD_MEMORY), ref.refType(RG_CARD_AUTH_PARAMS)]],
  'RG_Subscribe': ['uint32', ['pointer', ref.refType(RG_ENDPOINT), 'uint8', 'uint32', 'pointer']],
  'RG_PollEvents': ['uint32', ['pointer', 'pointer', 'pointer', 'uint32']],
  'RG_IsolateDevice': ['uint32', [ref.refType(RG_ENDPOINT), 'uint8']],
  'RG_ResetIsolation': ['uint32', [ref.refType(RG_ENDPOINT), 'uint8']],
  'RG_CloseDevice': ['uint32', [ref.refType(RG_ENDPOINT), 'uint8']],
  'RG_GetInfoExt': ['uint32', [ref.refType(RG_ENDPOINT), 'uint8', 'pointer']],
  'RG_Subscribe': ['uint32', ['pointer', ref.refType(RG_ENDPOINT), 'uint8', 'uint32', 'pointer']],

});

function errorToString(code) {
  for (const [k, v] of Object.entries(E_API_ERROR_CODES)) {
    if (v === code) return k;
  }
  return `Unknown error (${code})`;
}

module.exports = {
  E_RG_ENDPOINT_TYPE,
  E_RG_STATUS_TYPE,
  E_RG_CARD_FAMILY_CODE,
  E_API_ERROR_CODES,
  E_RG_DEVICE_EVENT_TYPE,
  RG_DEVICE_INFO_EXT,
  RG_ENDPOINT,
  RG_CARD_INFO,
  RG_ENDPOINT_INFO,
  rgsec,
  errorToString
}; 