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
  plist = require('plist-with-patches');

var win = gui.Window.get();
win.showDevTools();

//
// Provisionning management
//
function parseProvisionning(target, callback) {

  // Get srcPath and filename
  target = target.replace(/\\/g, '/');

  switch (extensionOf(target.split('/')[target.split('/').length - 1])) {
    case 'ipa':
    case 'zip':
      var zip = new AdmZip(target),
        entries = zip.getEntries();

      for (var i = 0; i < entries.length; ++i) {
        if (extensionOf(entries[i].entryName) === 'mobileprovision') {
          return analyseProvisionning(target + '/' + entries[i], function (err, result) {
            return callback(err, result);
          });
        }
      }
      break;
    case 'app':
      // App
      fs.readdir(target, function (err, files) {
        if (err) { return callback('Error while reading .app : ' + err); }

        for (var i = 0; i < files.length; ++i) {
          if (extensionOf(files[i]) === 'mobileprovision') {
            return analyseProvisionning(target + '/' + files[i], function(err, result) {
              return callback(err, result);
            });
          }
        }
        return callback('No provisionning found in ' + filename, null);
      });
      break;
    case 'mobileprovision':
      return analyseProvisionning(target, function(err, result) {
        return callback(err, result);
      });
    default:
      return callback('Bad extension, only ipa, zip, app or mobileprovision accepted');
  }
}

function analyseProvisionning(target, callback) {

  if (target === undefined || target === null) { return callback('Analyse failed'); }

  // Determine output path by the current platform
  var output;
  if (os.platform() == 'win32') {
    output = '%WinDir%\\Temp\\';
  } else  {
    output = '/tmp/';
  }
  output += 'out.mobileprovision.txt';

  // Decrypt mobileprovision
  openssl.exec('smime', {
    inform: 'DER',
    verify: true,
    noverify: true,
    in: target,
    out: output }, function(err, buffer) {
    // Openssl write on stderr its results even if it's a success, and the wrapper interpret it as an error =/
    if (err && err != 'Verification successful\n') { return callback(err); }
    try {
      console.log('here');
      return callback(null, plist.parseFileSync(output));
    } catch (e) {
      return callback(e);
    }
  });
}

//
// Certificate management
//
function parseCertificate(target, password, callback) {

  // Get srcPath and filename
  target = target.replace(/\\/g, '/');

  switch (extensionOf(target.split('/')[target.split('/').length - 1])) {
    case 'p12':
      decryptCertificate(target, password, function (err, pemPath) {
        if (err) { return callback(err); }
        return analyseCertificate(pemPath, function (err, result) {
          callback(err, result);
        });
      });
      break;
    case 'pem':
      return analyseCertificate(target, function (err, result) {
        callback(err, result);
      });
    default:
      return callback('Bad extension, only p12 or pem are accepted');
  }
}

function analyseCertificate(pemPath, callback) {

  fs.readFile(pemPath, 'utf8', function (err, data) {
    if (err) { return callback(err, null); }

    var BEGIN_CERTIF = '-----BEGIN CERTIFICATE-----',
        END_CERTIF = '-----END CERTIFICATE-----';
    var certArr = substringBetweenStrings(data, BEGIN_CERTIF, END_CERTIF);

    // Trim all '\n'
    for (var i = 0; i < certArr.length; ++i) {
      certArr[i] = certArr[i].replace(/\n/g, '');
    }

    console.log(certArr);
    return callback(null, certArr);
  });
}

function decryptCertificate(certifPath, password, callback) {

  if (certifPath === undefined || certifPath === null) { return callback('Analyse failed'); }
  if (password === undefined || password === null) { return callback('Password is required to decrypt a p12'); }

  // Determine output path by platform
  var output;
  if (/win/.test(os.platform())) {
    output = '%WinDir%\\Temp\\';
  } else  {
    output = '/tmp/';
  }
  output += 'out.pem';

  // TODO: Find a better way to decrypt the file without openssl dependency
  openssl.exec('pkcs12', {
    nodes: true,
    passin: 'pass:'+password,
    in: certifPath,
    out: output }, function(err, buffer) {
    // Openssl write on stderr its results even if it's a success, and the wrapper interpret it as an error =/
    if (err && err != 'MAC verified OK\n') { return callback(err); }
      return callback(null, output);
  });
}