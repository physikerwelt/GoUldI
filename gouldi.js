require('app-module-path').addPath(__dirname);

var express = require('express');
var app = express();
var path = require("path");
var yaml = require('js-yaml');
var BBPromise = require('bluebird');
var preq = require('preq');
var fs = BBPromise.promisifyAll(require('fs'));
var mathoidcfg = yaml.safeLoad(fs.readFileSync('config.yaml'));

require('app-module-path').addPath(path.join(__dirname + '/node_modules/vmext'));
var bodyParser = require('body-parser');

app.use(bodyParser.json({limit: "50mb"}));
app.use(bodyParser.urlencoded({limit: "50mb", extended: true, parameterLimit:50000}));
var GithubContent = require('github-content');
require('mathoid/server.js');

var githubChangeRemoteFile = require('github-change-remote-file');

// Allow CORS
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});


app.use('/node_modules', express.static(path.join(__dirname + '/node_modules')));
app.use('/scripts', express.static(path.join(__dirname + '/scripts')));
app.use('/styles', express.static(path.join(__dirname + '/styles')));
app.use('/widgets', express.static(path.join(__dirname + '/node_modules/vmext/public/widgets')));
app.use('/vendor', express.static(path.join(__dirname + '/node_modules/vmext/public/vendor')));
app.use('/', express.static(path.join(__dirname + '/node_modules/vmext/public/favicon.ico')));
app.use('/assets', express.static(path.join(__dirname + '/assets')));
app.use('/api', require("./node_modules/vmext/api/versions.js"));

app.post('/get-model', function (req, res) {
    var body = req.body;
    var gc = new GithubContent(body);
    gc.file(body.filename, function (err, file) {
        try {
            var json = JSON.parse(file.contents.toString());
            res.send(json);
        } catch (e) {
            res.status(400).send('Invalid JSON string');
        }
    });
});

app.post('/write-model', function (req, res) {
    var body = req.body;
    body.transform = function (x) {
        delete body.data.qID;
        return JSON.stringify(body.data, null, 2);
    };
    githubChangeRemoteFile(body)
        .then(function (inner_res) {
            res.send( inner_res );
        })
        .catch(function (err) {
            throw err;
        });
});

app.post('/render-math', function (req, res){
    preq.post(
        {
            uri: 'http://localhost:10044/svg/',
            encoding: null,
            body: {q: req.body.input, nospeech: true}
        }
    ).then( function(inner_res) {
        res.send( inner_res.body.toString() );
    }).catch( function(e){
        res.status(400).send('Error while render SVG: ' + e.message);
    } );
});

app.post('/latexml', function(req, res){
    preq.post(
        {
            uri: 'http://vmext-demo.wmflabs.org/math/',
            query: {
                latex: req.body.latex
            }
        }
    ).then( function(inner_res){
        res.send( inner_res.body.result );
    }).catch( function(e){
        res.status(400).send('Error while request LaTeXML: ' + e.message);
    })
});

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname + '/main.html'));
});

app.listen( mathoidcfg.gouldi.port, function () {
    console.log('Started GoUldI on ' + mathoidcfg.gouldi.port);
});