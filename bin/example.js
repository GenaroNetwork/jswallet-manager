const newWalletManager = require("..").newWalletManager
const generateMnemonic = require("..").generateMnemonic

const wm = newWalletManager("/Users/lishi/testkeys")

const jsonv3 = { version: 3,
    id: '7456871b-be58-4a57-a484-a460391e8878',
    address: '4055eb31916aa026871581f30ff03017bb2982ce',
    crypto:
     { ciphertext: '3eaf481529e0a9e31372febbb491b61056fc93ad74db35a8506bf1adf5bfa253',
       cipherparams: { iv: '6e793238033a7b3b4aa01a2f08bfb6f7' },
       cipher: 'aes-128-ctr',
       kdf: 'scrypt',
       kdfparams:
        { dklen: 32,
          salt: 'ed27a90c3156c7e714673e9ba3e609564eea6175140aaf47e27eeed4fb8b2555',
          n: 262144,
          r: 8,
          p: 1 },
       mac: 'fe93bdad3bd5c2406ec2a1e242caa76eaafadcc026a60bc58642db4a4eccac38' },
    name: 'wallet444' }


// 1 generate keys
const mnemonic = generateMnemonic()
const password = "123456"
wm.importFromMnemonic(mnemonic, password, "wallet111", true, null, 0)
wm.importFromMnemonic(mnemonic, password, "wallet222", true, null, 1)
wm.importFromMnemonic(mnemonic, password, "wallet333", true, null, 2)
wm.importFromMnemonic(mnemonic, password, "wallet444", true, null, 3)

// 2. test things

console.log(`manager home: ${wm.walletHomePath}`)
const wlist = wm.listWallet()
console.log('wallets address are:')
wlist.forEach(w => {
    console.log(w.address)
})

const address0 = wlist[0].address
const address1 = wlist[1].address
const found = wm.findWallet(address0)
console.log(`find wallet ${address0}:`)
console.log(found)

const prik = wm.exportPrivateKey(address0, password)
console.log(`${address0} private key: ${prik}`)

const jexport = wm.exportJson(address0)
console.log(`${address0} json: ${jexport}`)

wm.changePassword(address0, password, "654321")
console.log('password changed')


wm.deleteWallet(address1)
console.log(`${address1} deleted`)

wm.importFromJson(jsonv3, password, "wallet-imported", false)
console.log(`${jsonv3.address} imported`)