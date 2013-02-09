var app = {};
	app.view = {};

$(window).bind("load", function() {
	app.view = new View.main();
	app.control = new Control.main(app.view, model);
});

