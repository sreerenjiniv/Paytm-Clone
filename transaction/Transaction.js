var mongoose = require('mongoose');  
var TransactionSchema = new mongoose.Schema({  
     source : Number,
     destination : Number,
     amount : Number,
     state : String,
     transBy : Object     
});
mongoose.model('Transaction', TransactionSchema);
module.exports = mongoose.model('Transaction');
