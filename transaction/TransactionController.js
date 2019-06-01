var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());
var Transaction = require('./Transaction');
var Users = require('../user/User');

/** 
  * @api {post} http://localhost:3000/transaction
  * @apiParam fromMobile
  * @apiParam toMobile
  * @apiParam amount
*/
router.post('/', function (req, res) {
    var from = req.body.fromMobile;
    var to = req.body.toMobile;
    var amount = req.body.amount;
    if (req.isAuthenticated()) {
        performTransaction(from, to, amount, mongoose.Types.ObjectId(req.user)).then(function (data) {
            if (data === true) {
                return res.status(200).send("Transaction Success")
            } else {
                return res.status(400).send("Transaction Failed")
            }
        })
    } else {
        return res.status(400).send("Please Login.")
    }

});

/** 
 * Transaction Stages 
  * @apiParam from
  * @apiParam to
  * @apiParam amount
  * @apiParam userId
*/
function performTransaction(from, to, amount, userId) {
    return new Promise(function (resolve, reject) {
        var Sequence = exports.Sequence || require('sequence').Sequence, sequence = Sequence.create(), err;
        sequence
            .then(function (next) {
                Transaction.create({
                    source: from, destination: to, transBy: userId, amount: amount, state: "initial"
                }, function (err, transactionData) {
                    next(err, transactionData)
                });
            })
            .then(function (next, err, transactionData) {
                var tranId = transactionData._id;
                Transaction.update(
                    { _id: tranId }, { state: "pending" },
                    function (err, result) {
                        if (result.modifiedCount == 0) {
                            cancelTransaction(tranId);
                        }
                        next(err, tranId)
                    });
            })
            .then(function (next, err, tranId) {
                Users.update(
                    {
                        mobile: from, pendingTransactions: { $ne: tranId }, balance: { $gte: amount }
                    },
                    {
                        $inc: { balance: -amount }, $push: { pendingTransactions: tranId }
                    }, function (err, result1) {
                        if (result1.modifiedCount == 0) {
                            revokeTransaction(from, to, amount, tranId);
                            console.log("Failed to debit " + from + " account");
                        }
                        next(err, tranId)
                    })
            })
            .then(function (next, err, tranId) {
                Users.update(
                    {
                        mobile: to, pendingTransactions: { $ne: tranId }
                    },
                    {
                        $inc: { balance: amount }, $push: { pendingTransactions: tranId }
                    }, function (err, result2) {
                        if (result2.modifiedCount == 0) {
                            revokeTransaction(from, to, amount, tranId);
                            console.log("Failed to credit " + to + " account");
                        }
                        next(err, tranId)
                    })
            })
            .then(function (next, err, tranId) {
                /** Final committed transaction */
                Transaction.update(
                    { _id: tranId }, { state: "committed" },
                    function (err, result3) {
                        if (result3.modifiedCount == 0) {
                            revokeTransaction(from, to, amount, tranId);
                            console.log("Failed to move transaction " + tranId + " to committed");
                        }
                        next(err, tranId)
                    });
            })
            .then(function (next, err, tranId) {
                if (err) {
                    reject(err)
                } else {
                    removePendingTrans(from, to, tranId).then(function (responsedata) {
                        resolve(responsedata);
                    })
                }
            });
    });
}

function removePendingTrans(from, to, tranId) {
    return new Promise(function (resolve, reject) {
        var Sequence = exports.Sequence || require("sequence").Sequence, sequence = Sequence.create(), err;
        sequence
            .then(function (next) {
                Users.update(
                    { mobile: from }, { $pull: { pendingTransactions: tranId } }, function (err, resp) {
                        next(err)
                    })
            })
            .then(function (next, err) {
                Users.update(
                    { mobile: to }, { $pull: { pendingTransactions: tranId } }, function (err, resp1) {
                        next(err)
                    })
            })
            .then(function (next, err) {
                Transaction.updateOne(
                    { _id: tranId },
                    { $set: { state: "done" } },
                    function (err, resp2) {
                        if (err) {
                            reject(err)
                        } else {
                            resolve(true);
                        }
                    });
            })
    })
}
/** to cancel the Transaction */
function cancelTransaction(tranId) {
    Transaction.updateOne(
        { _id: tranId }, { $set: { state: "canceled" } },
        function (err, resp) {
            if (resp.modifiedCount == 0) {
                console.log("Transaction Failed");
            }
        });
}
/** to revoke the Transaction if failed */
function revokeTransaction(from, to, amount, tranId) {
    var Sequence = exports.Sequence || require("sequence").Sequence, sequence = Sequence.create(), err;
    sequence
        .then(function (next) {
            Users.update(
                { mobile: from, pendingTransactions: { $in: [tranId] } },
                { $inc: { balance: amount }, $pull: { pendingTransactions: tranId } }, function (err, res) {
                })
        })
        .then(function (next, err) {
            Users.update(
                { mobile: to, pendingTransactions: { $in: [tranId] } },
                { $inc: { balance: -amount }, $pull: { pendingTransactions: tranId } }, function (err, res1) {
                })
            cancelTransaction(tranId)
        })
}



/** 
 * Own transactions
  * @api {get} http://localhost:3000/transaction
*/

router.get('/', function (req, res) {
    if (req.isAuthenticated()) {
        userId = mongoose.Types.ObjectId(req.user);
        Users.aggregate([
            { $match: { _id: mongoose.Types.ObjectId(req.user) } },
            {
                $lookup: { from: "transactions", localField: "source", foreignField: "mobile", as: "transactions" }
            },
            {
                $project: {
                    //source: 1, destination: 1, amount: 1, name: "$users.name", balance: "$users.balance"
                    name: 1, balance: 1,
                    transactions: {
                        $filter: {
                            input: '$transactions',
                            as: 'transactions',
                            cond: { $eq: ['$$transactions.transBy', userId] }
                        }
                    }
                }
            },
        ]).exec(function (err, response) {
            res.json(response)
        });
    } else {
        res.status(400).send({ message: "Please Login" });
    }
});


/** 
 * All transactions for admin
  * @api {get} http://localhost:3000/transaction
*/

router.get('/transactions', function (req, res) {
    if (req.isAuthenticated()) {
        userIsAdmin(req.user).then(function (isAdmin) {
            if (isAdmin) {
                Users.aggregate([
                    {
                        $lookup: { from: "transactions", localField: "source", foreignField: "mobile", as: "transactions" }
                    },
                    {
                        $project: {
                            transactions: 1, name: 1, balance: 1
                        }
                    },
                ]).exec(function (err, response) {
                    res.json(response)
                });
            } else {
                res.status(400).send({ message: "Unauthorised" });
            }
        })
    } else {
        res.status(400).send({ message: "Please Login" });
    }

});


function userIsAdmin(user) {
    return new Promise(function (resolve, reject) {
        Users.find({ _id: mongoose.Types.ObjectId(user), isAdmin: true }, { _id: 1 }, function (err, user) {
            if (err) {
                reject(err)
            } else {
                var isAdmin = (user.length > 0) ? true : false;
                resolve(isAdmin);
            }
        });
    });
}

module.exports = router;