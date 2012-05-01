backbone-deep-model
===================

Improved support for models with nested attributes.

Allows you to get and set nested attributes with path syntax, e.g. `user.type`.

Triggers change events for changes on nested attributes.

Dependencies
============

Backbone >= 0.9.2

Usage
=====

To install, include the `src/backbone-deep-model.js` file in your HTML page, after Backbone and it's dependencies.

Then just have your models extend from Backbone.DeepModel instead of Backbone.Model.

Example code:

    //Create models with nested attributes
    var model = new Backbone.DeepModel({
        id: 123,
        user: {
            type: 'Spy',
            name: {
                first: 'Sterling',
                last: 'Archer'
            }
        },
        otherSpies: {
            { name: 'Lana' },
            { name: 'Cyrril' }
        }
    });
    
    //You can bind to change events on nested attributes
    model.bind('change:user.name.first', function(model, val) {
        console.log(val);
    });
    
    //Use set with a path name for nested attributes
    //NOTE you must you quotation marks around the key name when using a path
    model.set({
        'user.name.first': 'Lana',
        'user.name.last':  'Kang'
    });
    
    //Use get() with path names so you can create getters later
    console.log(model.get('user.type'));    // 'Spy'

    //You can use index notation to fetch from arrays
    console.log(model.get('otherSpies.0.name')) //'Lana'

Author
======

Charles Davison - [powmedia](http://github.com/powmedia)


Contributors
============

- [AsaAyers](https://github.com/AsaAyers)


Changelog
=========

0.7.1:
- Model.changedAttributes now works with nested attributes.
- Fix getting attribute that is an empty object

0.7:
- Update for Backbone v0.9.2