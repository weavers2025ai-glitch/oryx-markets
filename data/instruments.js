/* Oryx Markets — instruments (base prices are demo seeds; the terminal simulates a live feed around them) */
const INSTRUMENTS = [
  {symbol:'EURUSD', name:'Euro vs US Dollar',        type:'Forex',   base:1.08520, digits:5, spread:0.00012, contract:100000, tv:'FX:EURUSD'},
  {symbol:'GBPUSD', name:'Pound vs US Dollar',       type:'Forex',   base:1.26740, digits:5, spread:0.00014, contract:100000, tv:'FX:GBPUSD'},
  {symbol:'USDJPY', name:'US Dollar vs Yen',         type:'Forex',   base:154.320, digits:3, spread:0.014,   contract:100000, tv:'FX:USDJPY'},
  {symbol:'AUDUSD', name:'Aussie vs US Dollar',      type:'Forex',   base:0.65920, digits:5, spread:0.00014, contract:100000, tv:'FX:AUDUSD'},
  {symbol:'USDCAD', name:'US Dollar vs Canadian',    type:'Forex',   base:1.39210, digits:5, spread:0.00016, contract:100000, tv:'FX:USDCAD'},
  {symbol:'USDCHF', name:'US Dollar vs Swiss Franc', type:'Forex',   base:0.88460, digits:5, spread:0.00015, contract:100000, tv:'FX:USDCHF'},
  {symbol:'XAUUSD', name:'Gold vs US Dollar',        type:'Metals',  base:2652.40, digits:2, spread:0.28,    contract:100,    tv:'TVC:GOLD'},
  {symbol:'XAGUSD', name:'Silver vs US Dollar',      type:'Metals',  base:31.240,  digits:3, spread:0.028,   contract:5000,   tv:'TVC:SILVER'},
  {symbol:'WTIUSD', name:'US Crude Oil',             type:'Energies',base:69.42,   digits:2, spread:0.04,    contract:1000,   tv:'TVC:USOIL'},
  {symbol:'BTCUSD', name:'Bitcoin vs US Dollar',     type:'Crypto',  base:97450,   digits:1, spread:38.0,    contract:1,      tv:'BITSTAMP:BTCUSD'},
  {symbol:'ETHUSD', name:'Ethereum vs US Dollar',    type:'Crypto',  base:3420.5,  digits:2, spread:2.6,     contract:10,     tv:'BITSTAMP:ETHUSD'},
  {symbol:'US30',   name:'Dow Jones 30 Index',       type:'Indices', base:43850,   digits:1, spread:3.2,     contract:10,     tv:'TVC:DJI'},
  {symbol:'NAS100', name:'Nasdaq 100 Index',         type:'Indices', base:21240,   digits:1, spread:2.4,     contract:10,     tv:'NASDAQ:NDX'},
  {symbol:'AAPL',   name:'Apple Inc. Shares',        type:'Shares',  base:229.40,  digits:2, spread:0.14,    contract:100,    tv:'NASDAQ:AAPL'}
];
