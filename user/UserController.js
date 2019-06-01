var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());
var User = require('./User');
var passportController = require('./passportController');
var crypto = require('crypto');

/** 
 * Register New user
  * @api {post} http://localhost:3000/users
  * @apiParam name
  * @apiParam email
  * @apiParam password
  * @apiParam mobile
  * @apiParam balance
  * @apiParam isAdmin
*/
router.post('/', function (req, res) {
    var mobile = req.body.mobile;
    getUser(mobile).then(function (dataUser) {
        if (dataUser.length === 0) {
            var encriptedPassword = getEncriptedPassword(req.body.password);
            User.create({
                name: req.body.name,
                email: req.body.email,
                encrypedPassword: encriptedPassword,
                mobile: mobile,
                balance: req.body.balance,
                isActive: true,
                isAdmin: req.body.isAdmin,
                pendingTransactions: []
            },
                function (err, user) {
                    if (err) return res.status(500).send(err);
                    res.status(200).send(user);
                });
        } else {
            res.json("Duplicate User")
        }
    });
});

function getUser(phone) {
    return new Promise(function (resolve, reject) {
        User.find({ mobile: phone }, { _id: 1 }, function (err, user) {
            if (err) {
                reject(err)
            } else {
                resolve(user);
            }
        });
    });
}

function getEncriptedPassword(password) {
    var salt = "qkgjkhkdsjuhdkshlkhllh";
    if (!password || !salt) return "";
    var salt = new Buffer(salt, "base64");
    return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha1").toString("base64");
}

/** 
 * Sign in
  * @api {post} http://localhost:3000/users/api/auth/signin
  * @apiParam mobile
  * @apiParam password
*/
router.post('/api/auth/signin', function (req, res) {
    User.findOne({ mobile: req.body.mobile }).then((user) => {
        passportController.authenticate("local")(req, res, function (err, data) {
            if (err) {
                res.status(400).send({ error: err.message });
            } else if (req.session && req.session.passport.user) {
                res.status(200).send({ message: "Login Success" });
            } else {
                res.status(400).send({ error: "Login Failed" });
            }
        });
    });
})

module.exports = router;