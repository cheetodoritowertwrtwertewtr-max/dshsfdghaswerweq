let fontsLoad = []
let font = document.createElement('link')
document.head.append(font)

function SetFontCustom(dir, name) {
	let newStyle = document.createElement('style');
	newStyle.append(document.createTextNode("\
	@font-face {\
	    font-family: " + name + ";\
	    src: url('" + "file:///" + dir + "') format('truetype');\
	}\
	"))
	document.head.append(newStyle)
}
function SetFont(name) {
	if (fontsLoad.indexOf(name) == -1 && name != 'custom' && name != ''){
		fontsLoad.push(name)
		UpdateFont()
	}
}

function UpdateFont() {
	while (fontsLoad.indexOf('') != -1) {
		fontsLoad.splice(fontsLoad.indexOf(''), 1)
	}

	font.rel = 'stylesheet'
	font.href = 'https://fonts.googleapis.com/css?family=' + fontsLoad.join('|')
}