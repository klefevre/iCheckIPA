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
  openssl = require('openssl-wrapper'),
  plist = require('plist-with-patches'),
  exec = require('child_process').exec;

var win = gui.Window.get();
win.showDevTools();

function parseCertificate(target, callback) {
}

//
// Provisionning management
//
function parseProvisionning(target, callback) {

  // Get srcPath and filename
  target = target.replace(/\\/g, '/');
  var filename = target.split('/')[target.split('/').length - 1];
  var extension = extensionOf(filename);

  if (extension == 'ipa' || extension == 'zip') {
    // IPA/ZIP
    var zip = new AdmZip(target),
      entries = zip.getEntries();

    for (var i = 0; i < entries.length; ++i) {
      if (extensionOf(entries[i].entryName) === 'mobileprovision') {
        return analyseProvisionning(target + '/' + entries[i], function (err, result) {
          return callback(err, result);
        });
      }
    }

  } else if (extension == 'app') {
    // App
    fs.readdir(target, function (err, files) {
      if (err) {
        return callback('Error while reading .app : ' + err);
      }

      for (var i = 0; i < files.length; ++i) {
        if (extensionOf(files[i]) === 'mobileprovision') {
          return analyseProvisionning(target + '/' + files[i], function(err, result) {
            return callback(err, result);
          });
        }
      }
      return callback('No provisionning found in ' + filename, null);
    });

  } else if (extension == 'mobileprovision') {
    // Mobileprovision
    return analyseProvisionning(target, function(err, result) {
      return callback(err, result);
    });

  } else {
    // Bad extension
    return callback('Bad extension, only ipa, zip, app or mobileprovision accepted');

  }
}

function analyseProvisionning(target, callback) {
  console.info('----------------------------------');
  console.info('Analysing provisionning at', target);

  if (target === undefined || target === null) {
    return callback('Analyse failed');
  }

  openssl.exec('smime', {inform: 'DER', verify: true, in: target, out: '/tmp/out.pem'}, function(err, buffer) {
    if (err && !buffer) {
      return callback(err);
    } else {
      var result = plist.parseFileSync('/tmp/out.pem');
      return callback(null, result);
    }
  });

  return;

  // TODO: Find a way to NOT use exec -> EVIL. Maybe we may achieve it using crypto, node-forge or something else ?
  var child = exec('openssl smime -inform DER -verify -in ' + target, function (error, stdout, stderr) {
    var result = null;
    if (error == null) {
      result = plist.parseStringSync(stdout);
    }
    callback(error, result);
  });
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