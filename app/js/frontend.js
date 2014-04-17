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

var g_certificate,
    g_provisionning

$(window).load(function () {
  //Load the settings and start the backend webserver.
  loadSettings();

  $('#carousel-example-generic').on('slid.bs.carousel', function () {
    var $this = $(this);
//    if($('.carousel-inner .item:first').hasClass('active')) {
//      $this.children('.left.carousel-control').hide();
//    } else if($('.carousel-inner .item:last').hasClass('active')) {
//      $this.children('.right.carousel-control').hide();
//    } else {
//      $this.children('.carousel-control').show();
//    }
  });

  $('#button-settings-delete-cache').click(function (e) {
//       fs.exists(process.cwd() + '/../tmp/', function (exist) {
//            if (exist) {
//                rimraf(process.cwd() + '/../tmp/', function (err) {
//                    if (err) { return console.error('Err =', err); }
//
//                    $(this).popover('show');
//                });
//            } else {
//                console.log('already deleted');
//            }
//        });
  });

  var provPath,
      certPath

  $('.dropzone').on('dragenter dragleave drop', function (e) {
    e.stopPropagation();
    e.preventDefault();

    $this = $(this);

    switch (e.type) {
      case 'dragenter':
        console.log('e.originalEvent.dataTransfer.files.length =', e.originalEvent.dataTransfer.files.length);
        if (e.originalEvent.dataTransfer.files.length > 1) {
          console.log('Only 1 file could be accepted at once');
          return;
        }
        $this.addClass('hover');
        break;
      case 'dragleave':
        $this.removeClass('hover');
        break;
      case 'drop':
        $this.removeClass('hover');

        // Get srcPath and filename
        var srcPath = e.originalEvent.dataTransfer.files[0].path;
        var filename = srcPath.split('/')[srcPath.split('/').length - 1];

        console.log('srcPath =', e.originalEvent.dataTransfer.files[0].path);

        switch ($this.attr('id')) {

          case 'prov_dropzone':
            switch (extensionOf(filename)) {
              case 'ipa': case 'zip': case 'mobileprovision': case 'app':
                displayProvisionningInfos((provPath = srcPath), false);
                break;
              default:
                displayProvisionningInfos(srcPath, true);
                break;
            }
            break;

          case 'cert_dropzone':
            switch (extensionOf(filename)) {
              case 'p12': case 'pem':
                displayCertificateInfos((certPath = srcPath), false);
                break;
              default:
                displayCertificateInfos(srcPath, true);
                break;
            }
            break;
        }
        break;
    }
  });

  $('#start-analyse-button').click(function (e) {
    if (provPath) {
      parseProvisionning(provPath, function (err, file) {
        console.log('err =', err, '- file =', file);
        if (err) { return analyseFailed(err); }

        // Unlock tabs
        $('#tabs-results a').click(function (e) {
          e.preventDefault();
          $(this).tab('show');
        });

        // Display results
        displayProvisionningResults(file);
      });
    }
    if (certPath) {
      parseCertificate(certPath, $('#password-input').val(), function (err, file) {
        if (err) { return analyseFailed(err); }

        // Unlock tabs
        $('#tabs-results a').click(function (e) {
          e.preventDefault();
          $(this).tab('show');
        });

        // Display results
        displayCertificateResults(file);
      });
    }
  });
});

function displayError(selector, path) {

}

function displayProvisionningInfos(path, isError) {
  var filename = path.split('/')[path.split('/').length - 1];
  var text = $('#prov_dropzone > span');

  // Remove all className beginning by 'label-'
  text[0].className = text[0].className.replace(/\blabel-.*?\b/g, '');
  text.text('');

  if (!isError) {
    // Display info
    text.addClass('label-success');
    text.append('<u>Filename :</i> '+filename);
    text.append('\n<u>Path :</i> '+path);
    text.append('\n<u>Kind of analyse :</i> '+extensionOf(filename));
  } else {
    // Display error
    text.addClass('label-danger');
    text.append('<u>ERROR</u> : This kind of file is not supported : only <i>.ipa</i>, <i>.zip</i>,\n<i>.mobileprovision</i> or <i>.app</i> is supported.\n');
    text.append('\n<u>Filename :</u> '+filename);
    text.append('\n<u>Path :</u> '+path);
    text.append('\n<u>Kind of analyse :</u> '+'<i>Undeterminated</i>');
  }
}

function displayCertificateInfos(path, isError) {
  var filename = path.split('/')[path.split('/').length - 1];
  var text = $('#cert_dropzone > span');

  // Remove all className beginning by 'label-'
  text[0].className = text[0].className.replace(/\blabel-.*?\b/g, '');
  text.text('');

  if (!isError) {
    // Display info
    text.addClass('label-success');
    text.append('<u>Filename :</u> '+filename);
    text.append('\n<u>Path :</u> '+path);
    text.append('\n<u>Kind of analyse :</u> '+extensionOf(filename));
    text.append('\n<u>Password required :</u> '+'YES');
  } else {
    // Display error
    text.addClass('label-danger');
    text.append('<u>ERROR</u> : This kind of file is not supported : only <b>.p12</b> or <b>.pem</b> is supported.\n');
    text.append('\n<i>Filename :</i> '+filename);
    text.append('\n<i>Path :</i> '+path);
    text.append('\n<i>Kind of analyse :</i> '+'<i>Undeterminated</i>');
    text.append('\n<i>Password required :</i> '+'<i>Unknown</i>');
  }
}

//
// UI Management
//

function resetUI() {
  $('#panel-results').css('visibility', 'hidden');
  $('#list-entitlements').empty();
  $('#list-udid').empty();
}

function displayCertificateResults(results) {
  console.log(results);
  g_certificate = results;


}

function displayProvisionningResults(results) {
  g_provisionning = results;

  // Entitlements
  obj = results['Entitlements'];
  $list = $('#list-entitlements');

  // Debug
  text = 'Debug : ' + ((obj['get-task-allow'] === undefined ||
    obj['get-task-allow'] === null) ? '?' : (obj['get-task-allow'] ? 'true' : 'false'));
  $list.append($('<li class="list-group-item">').append(text));

  // Push
  text = 'Push : ' + ((obj['aps-environment'] === undefined ||
    obj['aps-environment'] === null) ? 'NO' : obj['aps-environment']);
  $list.append($('<li class="list-group-item">').append(text));

  // Conclusion
  text = 'Conclusion : ';
  if (results['Entitlements']['get-task-allow'] && results['ProvisionedDevices'] !== undefined) {
    text += 'Development';
  } else if (!results['Entitlements']['get-task-allow'] && results['ProvisionedDevices'] !== undefined) {
    text += 'AdHoc';
  } else if (!results['Entitlements']['get-task-allow'] && results['ProvisionsAllDevices'] !== undefined) {
    text += 'InHouse';
  } else if (!results['Entitlements']['get-task-allow'] && results['ProvisionedDevices'] === undefined) {
    text += 'AppStore';
  } else {
    text += 'Unknown';
  }
  $list.append($('<li class="list-group-item">').append(text));

  // UDID
  obj = results['ProvisionedDevices'];
  $list = $('#list-udid');
  if (obj !== undefined && obj !== null) {
    for (var i = 0; i < obj.length; ++i) {
      $list.append($('<li class="list-group-item">').append(obj[i]));
    }
  }
}

function analyseFailed(err) {
  console.log('Error :', err);
  alert(err);
}

//
// Settings management
//
// Load settings function.
function loadSettings() {
  console.log('Loaded settings');
  var port_setting = document.getElementById('port_setting');
  var name_setting = document.getElementById('name_setting');

  if (!(localStorage.settings)) {
    var settings = {
      port : 3000,
      name : "Dropzone"
    }
  }
  else {
    var settings = JSON.parse(localStorage.settings);
  }

  port_setting.value = settings.port;
  name_setting.value = settings.name;

  port_setting.onkeyup = function (e) {
    if (e.which == 13) {
      extractSettings();
    }
  }
  name_setting.onkeyup = function (e) {
    if (e.which == 13) {
      extractSettings();
    }
  }
  localStorage.setItem('settings', JSON.stringify(settings));
}

// A function for extracting settings.
function extractSettings() {
  console.log('Extracted settings.');
  var port_setting = document.getElementById('port_setting').value;
  var name_setting = document.getElementById('name_setting').value;

  var settings = {
    port : port_setting,
    name : name_setting
  }
  localStorage.setItem('settings', JSON.stringify(settings));
}

//
// Helper
//
// Extract extension of a filename e.g. blabla.zip => zip
function extensionOf(filename) {
  return filename.substr((~-filename.lastIndexOf(".") >>> 0) + 2);
}

// Extract substrings between two string e.g. "TOTOTITITATA", "TOTO", "TATA" = [TITI]
function substringBetweenStrings(str, firstStr, secondStr) {
  var retArr = new Array(),
    tmpStr = str,
    i = 0,
    beginIdx,
    endIdx;

  while ((beginIdx = tmpStr.indexOf(firstStr)) > -1 &&
    ((endIdx = tmpStr.indexOf(secondStr)) > -1)) {
    retArr[i++] = tmpStr.substring(beginIdx + firstStr.length + 1, endIdx - 1);
    tmpStr = tmpStr.substring(endIdx + secondStr.length, tmpStr.length);
  }
  return retArr;
}
