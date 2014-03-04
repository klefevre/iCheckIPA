/**
 * (The MIT License)
 *
 * Copyright (c) 2014 Kevin Lefevre <contact@kevinlefevre.com>
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated
 * documentation files (the 'Software'), to deal in the Software
 * without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice
 * shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

    var http = require('http'),
        fs = require('fs-extra'),
        gui = require('nw.gui'),
        os = require('os'),
        url = require('url'),
        AdmZip = require('adm-zip'),
        plist = require('plist'),
        rimraf = require('rimraf'),
        exec = require('child_process').exec;

    var win = gui.Window.get();
    win.showDevTools();


    function parseCertificate(target, callback) {
        fs.readJsonFile('../mocks/certificate.json', function(file, err) {
            callback(file, err);
        });
    }

function parseProvisionning(target, callback) {
    fs.readJsonFile('../mocks/provisionning.json', function(file, err) {
        callback(file, err);
    });
}

    function parseProvisionning(target) {
        return fs.readJsonFile('../mocks/provisionning.json');
    }
//
// Provisionning management
//
    function analyseProvisionning(path) {
        console.info('----------------------------------');
        console.info('Analysing provisionning at', path);

        if (path === undefined || path === null) { return analyseFailed('Analyse failed'); }

        // TODO: Find a way to NOT use exec -> EVIL. Maybe we may achieve it using crypto, node-forge or something else ?
        var child = exec('openssl smime -inform DER -verify -in ' + path,
            function (error, stdout, stderr) {
                if (error === null) {
                    console.log('stdout =', stdout);
                    var result = plist.parseStringSync(stdout);
                    console.log('result =', result);
                    displayResults(result);
                } else {
                    console.error('exec error: ' + error);
                }
            });
    }

    function extractProvisionning(filename, targetPath, tmpDir, callback) {
        switch (extensionOf(filename)) {
            case 'ipa': { // Unzip .ipa, extract the .mobileprovision, and analyse it
                var zip = new AdmZip(targetPath),
                    entries = zip.getEntries();

                for (var i = 0; i < entries.length; ++i) {
                    if (extensionOf(entries[i].entryName) === 'mobileprovision') {
                        zip.extractEntryTo(entries[i].entryName, tmpDir, false, true);
                        return callback(null, tmpDir + '/' + entries[i].name);
                    }
                }
                return callback('No provisionning found in ' + entries[i].name, null);
            }
            case 'app': { // Read the .app (only at the root level), and analyse it
                fs.readdir(targetPath, function (err, files) {
                    if (err) { return analyseFailed('Error while reading .app : ' + err); }
                    for (var i = 0; i < files.length; ++i) {
                        console.log(files[i]);
                        if (extensionOf(files[i]) === 'mobileprovision') {
                            console.log('==> provisionning found')
                            return callback(null, targetPath + '/' + files[i]);
                        }
                    }
                    return callback('No provisionning found in ' + filename, null);
                });
                break;
            }
            case 'mobileprovision': // Just analyse the .mobileprovision
                return callback(null, targetPath);
            default:
                break;
        }
    }


//
// Certificate management
//
    function analyseCertificate(pemPath, callback) {
        fs.readFile(pemPath, 'utf8', function (err, data) {
            if (err) { return callback(err, null); }

            console.log('- analyseCertificate --------------------');
            console.log('pemPath =', pemPath);
            console.log('data =', data);

            var BEGIN_CERTIF = '-----BEGIN CERTIFICATE-----',
                END_CERTIF = '-----END CERTIFICATE-----',
                certArr = substringBetweenStrings(data, BEGIN_CERTIF, END_CERTIF);

            // Trim all '\n'
            for (var i = 0; i < certArr.length; ++i) {
                certArr[i] = certArr[i].replace(/\n/g, '');
            }

            console.log(certArr);
            return callback(null, certArr);
        });
    }

    function decryptCertificate(certifPath, password, callback) {
        if (certifPath === undefined || certifPath === null) { return analyseFailed('Analyse failed'); }
        if (password === undefined || password === null) { return analyseFailed('Password is required to decrypt a p12'); }

        // TODO: Find a way to NOT use exec -> EVIL. Maybe we may achieve it using crypto, node-forge or something else ?
        var child = exec('openssl pkcs12 -nodes -in ' + certifPath + ' -out ' + certifPath + '.pem' + ' -passin pass:' + password,
            function (error, stdout, stderr) {
                if (error) { return callback(error, null); }
                return callback(null, certifPath + '.pem')
            });
    }

    function extractCertificate(filename, targetPath, callback) {
        // Check extension's file
        switch (extensionOf(filename)) {
            case 'p12':
                decryptCertificate(targetPath, 'test', function(err, pemPath) {
                    return callback(err, pemPath);
                });
                break;
            case 'pem':
                return callback(null, targetPath);
            default:
                return analyseFailed('Bad extension file');
        }
    }