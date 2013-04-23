/*jshint expr:true eqnull:true */
/**
 *
 * Backbone.DeepModel v{{version}}
 *
 * Copyright (c) 2013 Charles Davison, Pow Media Ltd
 *
 * https://github.com/powmedia/backbone-deep-model
 * Licensed under the MIT License
 */

;(function(factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['underscore', 'backbone'], factory);
    } else {
        // globals
        factory(_, Backbone);
    }
}(function(_, Backbone) {

    {{body}}

    return Backbone;
}));

