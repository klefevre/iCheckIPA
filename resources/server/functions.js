$(document).ready(function () {
	$('section#underbar ul li').mouseenter(function () {
		$(this).find('span').fadeIn('fast');
	});
    
    $('section#underbar ul li').mouseleave(function () {
       $(this).find('span').fadeOut('fast');
    });
    
    if ($('body').attr('id') == 'uploadzone') {
    	uploadZone();
    }
});

function togo() {
    var link = '/?zip';
    $('section#list table tbody tr td:first-child input').each(function (i) {
        if ($($('section#list table tbody tr td:first-child input')[i]).is(':checked')) {
            link += '&' + $($('section#list table tbody tr td:first-child input')[i]).attr('class');    
        }
       
    });
    document.location = link;
}

function uploadZone() {
	
	window.ondragover = function(e) { e.preventDefault(); return false };
	window.ondrop = function(e) { e.preventDefault(); return false };
	
	var dropzone = document.getElementById('uploadzone');
	
	dropzone.ondrop = function (e) {
		
		var dt = e.dataTransfer || (e.originalEvent && e.originalEvent.dataTransfer);
	    var files = e.target.files || (dt && dt.files);
	    
		//Make sure that the window doesn't show the file in plain text.
		e.preventDefault();
		
		//Change the inside message of the dropzone to 'Drop files in here to instantly share them!'
		document.getElementById('drop_message').innerHTML = 'Drop files in here to instantly share them!';
		
		//Make sure that all of the files that are dropped in get linked inside the ./files/ folder inside the application.
		for (i = 0; i < files.length; i++) {
			//Get the path of the file.
			var path = files[i].path;
			//Here's a small glitch that needed to be fixed in Windows, not even sure if I'll release it on that platform -_-.
			//path = path.replace(/\\/g, "/");
			//Get the filename
			var filename = path.split('/')[path.split('/').length - 1];
			//Log the filename, path and link path.
			console.log('Filename : ' + filename);
			console.log('Path : ' + files[i].path);
			//In windows, copy the file to the directory if it's another system, create a symbolic link.
			
		}
		
	}
	
	//An event for when the user enters the drag field with files.
	dropzone.ondragenter = function () {
		//Make sure that the message inside is changed.
		document.getElementById('drop_message').innerHTML = 'Let go of the mouse button to upload the files.';
	}
	
	//Another event for when the user leaves the dropzone.
	dropzone.ondragleave = function () {
		//Make sure that the message inside is changed.
		document.getElementById('drop_message').innerHTML = 'Drop files in here to instantly share them!';
	}
}