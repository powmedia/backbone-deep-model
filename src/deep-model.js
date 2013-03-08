/**
 * Main source
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
    
    /**
     * Takes a nested object and returns a shallow object keyed with the path names
     * e.g. { "level1.level2": "value" }
     *
     * @param  {Object}      Nested object e.g. { level1: { level2: 'value' } }
     * @return {Object}      Shallow object with path names e.g. { 'level1.level2': 'value' }
     */
    function objToPaths(obj) {
        var ret = {},
            separator = DeepModel.keyPathSeparator;

        for (var key in obj) {
            var val = obj[key];

            if (val && val.constructor === Object && !_.isEmpty(val)) {
                //Recursion for embedded objects
                var obj2 = objToPaths(val);

                for (var key2 in obj2) {
                    var val2 = obj2[key2];

                    ret[key + separator + key2] = val2;
                }
            } else {
                ret[key] = val;
            }
        }

        return ret;
    }

    // FROM backbone-nested
    /**
     *  converts a string path into an array of path segments.
     *  examples:
     *   r = attrPath('person[2].weight')   // r is [ 'person', 2, 'weight' ]
     *   r = attrPath('embedder.another')   // r is [ 'embedder', 'another' ]
     */
    function attrPath (attrStrOrPath) {
      var path, pattern;
      if (_.isString(attrStrOrPath)){
        // modified the regex to support DeepModel.keyPathSeparator instead of hardcoding .
        pattern = new RegExp('[^\\'+ DeepModel.keyPathSeparator +'\\[\\]]+', 'g')
        //pattern = /[^\.\[\]]+/g
        // TODO this parsing can probably be more efficient
        path = (attrStrOrPath === '') ? [''] : attrStrOrPath.match(pattern);
        path = _.map(path, function(val){
          // convert array accessors to numbers
          return val.match(/^\d+$/) ? parseInt(val, 10) : val;
        });
      } else {
        path = attrStrOrPath;
      }
      return path;
    }

    /**
     *  converts an array of path segments into a string path.
     *  examples:
     *   r = createAttrString([ 'accounts', 4, 'address', 'city']) // r is 'accounts[4].address.city'
     */
    function createAttrStr (attrPath) {
      var attrStr = attrPath[0];
      _.each(_.rest(attrPath), function(attr){
        attrStr += _.isNumber(attr) ? ('[' + attr + ']') : ('.' + attr);
      });
      return attrStr;
    }

    // adapted using code from backbone-nested
    /**
     * @param {Object}  Object to fetch attribute from
     * @param {String}  Object path e.g., 'user.name'
     * @return {Mixed}
     */
    function getNested(obj, path) {
      var attrP = attrPath(path),
          result;

      walkPath(obj, attrP, function(val, path){
        var attr = _.last(path);
        if (path.length === attrP.length){
          // attribute found
          result = val[attr];
        }
      });

      return result;
    }

    // adapted using code from backbone-nested
    /**
     * @param {Object} obj                Object to fetch attribute from
     * @param {String} path               Object path e.g. 'user.name'
     * @param {Mixed} val                 Value to set
     * @param {Object} [options]          Options
     * @param {Boolean} [options.unset]   Whether to delete the value
     */
    function setNested(obj, path, newValue, options) {
      options = options || {};

      // Backbone 0.9.0+ syntax: `model.set(key, val)` - convert the key to an attribute path
      var attrP = attrPath(path);
      
      var fullPathLength = attrP.length;
      var newAttrs = obj;

      walkPath(newAttrs, attrP, function(val, path){
        var attr = _.last(path);
        if (path.length === fullPathLength){
          // reached the attribute to be set 
          if (options.unset){
            delete val[attr];     // unset the value
          } else {
            
            val[attr] = newValue; // Set the new value
          }
        } else if (!val[attr]){
          if (_.isNumber(attr)){
            val[attr] = [];
          } else {
            val[attr] = {};
          }
        }
      });
    }

    // FROM backbone-nested
    function walkPath (obj, attrPath, callback, scope){
      var val = obj,
          childAttr;

      // walk through the child attributes
      for (var i = 0; i < attrPath.length; i++){
        callback.call(scope || this, val, attrPath.slice(0, i + 1));

        childAttr = attrPath[i];
        val = val[childAttr];
        if (!val) break; // at the leaf
      }
    }


    function deleteNested(obj, path) {
      setNested(obj, path, null, { unset: true });
    }

    var DeepModel = Backbone.Model.extend({

        // Override constructor
        // Support having nested defaults by using _.deepExtend instead of _.extend
        constructor: function(attributes, options) {
            var defaults;
            var attrs = attributes || {};
            this.cid = _.uniqueId('c');
            this.attributes = {};
            if (options && options.collection) this.collection = options.collection;
            if (options && options.parse) attrs = this.parse(attrs, options) || {};
            if (defaults = _.result(this, 'defaults')) {
                //<custom code>
                // Replaced the call to _.defaults with _.deepExtend.
                attrs = _.deepExtend({}, defaults, attrs);
                //</custom code>
            }
            this.set(attrs, options);
            this.changed = {};
            this.initialize.apply(this, arguments);
        },

        // taken and modified from backbone-nested
        /**
         * add an element to an array
         */
        add: function(attrStr, value, options){
          options = options || {};

          var current = this.get(attrStr);
          if (!_.isArray(current)) throw new Error('current value is not an array');

          // TODO: only trigger add event if validation succeeds
          // if set succeeded and not silent, should trigger an add event
          model = this.set(attrStr + '[' + current.length + ']', value, options);
          if(!options.silent && model) {
              model.trigger('add:' + attrStr, model, value);
          }

          return this.set(attrStr + '[' + current.length + ']', value, options);
        },

        // taken from backbone-nested
        /**
         * remove an element from an array
         */
        remove: function(attrStr, options){
          options = options || {};

          var attrP = attrPath(attrStr),
            aryPath = _.initial(attrP),
            val = this.get(aryPath),
            i = _.last(attrP);

          if (!_.isArray(val)){
            throw new Error("remove() must be called on a nested array");
          }

          // only trigger if an element is actually being removed
          var trigger = !options.silent && (val.length >= i + 1),
            oldEl = val[i];

          // remove the element from the array
          val.splice(i, 1);
          options.silent = true; // Triggers should only be fired in trigger section below

          // Mike: get the string path of the object with the removed item so we can set it's new value
          attrStr = createAttrStr(aryPath);
        
          this.set(attrStr, val, options);

          if (trigger){
            this.trigger('remove:' + attrStr, this, oldEl);
            for (var aryCount = aryPath.length; aryCount >= 1; aryCount--) {
              attrStr = createAttrStr(_.first(aryPath, aryCount));
              this.trigger('change:' + attrStr, this, oldEl);
            }
            this.trigger('change', this, oldEl);
          }

          return this;
        },


        // Return a copy of the model's `attributes` object.
        toJSON: function(options) {
          return _.deepClone(this.attributes);
        },

        // Override get
        // Supports nested attributes via the syntax 'obj.attr' e.g. 'author.user.name'
        get: function(attr) {
            return getNested(this.attributes, attr);
        },

        // Override set
        // Supports nested attributes via the syntax 'obj.attr' e.g. 'author.user.name'
        set: function(key, val, options) {
            var attr, attrs, unset, changes, silent, changing, prev, current;
            if (key == null) return this;
            
            // Handle both `"key", value` and `{key: value}` -style arguments.
            if (typeof key === 'object') {
              attrs = key;
              options = val || {};
            } else {
              (attrs = {})[key] = val;
            }

            options || (options = {});
            
            // Run validation.
            if (!this._validate(attrs, options)) return false;

            // Extract attributes and options.
            unset           = options.unset;
            silent          = options.silent;
            changes         = [];
            changing        = this._changing;
            this._changing  = true;

            if (!changing) {
              this._previousAttributes = _.deepClone(this.attributes); //<custom>: Replaced _.clone with _.deepClone
              this.changed = {};
            }
            current = this.attributes, prev = this._previousAttributes;

            // Check for changes of `id`.
            if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

            //<custom code>
            attrs = objToPaths(attrs);
            //</custom code>

            // For each `set` attribute, update or delete the current value.
            for (attr in attrs) {
              val = attrs[attr];

              //<custom code>: Using getNested, setNested and deleteNested
              if (!_.isEqual(getNested(current, attr), val)) changes.push(attr);
              if (!_.isEqual(getNested(prev, attr), val)) {
                setNested(this.changed, attr, val);
              } else {
                deleteNested(this.changed, attr);
              }
              unset ? deleteNested(current, attr) : setNested(current, attr, val);
              //</custom code>
            }

            // Trigger all relevant attribute changes.
            if (!silent) {
              if (changes.length) this._pending = true;

              //<custom code>
              var separator = DeepModel.keyPathSeparator;

              for (var i = 0, l = changes.length; i < l; i++) {
                var key = changes[i];

                this.trigger('change:' + key, this, getNested(current, key), options);
                var fields = key.split(separator);

                //Trigger change events for parent keys with wildcard (*) notation
                for(var n = fields.length - 1; n > 0; n--) {
                  var parentKey = _.first(fields, n).join(separator),
                      wildcardKey = parentKey + separator + '*';

                  this.trigger('change:' + wildcardKey, this, getNested(current, parentKey), options);
                }
                //</custom code>
              }
            }

            if (changing) return this;
            if (!silent) {
              while (this._pending) {
                this._pending = false;
                this.trigger('change', this, options);
              }
            }
            this._pending = false;
            this._changing = false;
            return this;
        },

        // Clear all attributes on the model, firing `"change"` unless you choose
        // to silence it.
        clear: function(options) {
          var attrs = {};
          //<custom code>
          var shallowAttributes = objToPaths(this.attributes);
          //</custom code>
          for (var key in shallowAttributes) attrs[key] = void 0;
          return this.set(attrs, _.extend({}, options, {unset: true}));
        },

        // Determine if the model has changed since the last `"change"` event.
        // If you specify an attribute name, determine if that attribute has changed.
        hasChanged: function(attr) {
          if (attr == null) return !_.isEmpty(this.changed);
          return getNested(this.changed, attr) !== undefined;
        },

        // Return an object containing all the attributes that have changed, or
        // false if there are no changed attributes. Useful for determining what
        // parts of a view need to be updated and/or what attributes need to be
        // persisted to the server. Unset attributes will be set to undefined.
        // You can also pass an attributes object to diff against the model,
        // determining if there *would be* a change.
        changedAttributes: function(diff) {
          //<custom code>: objToPaths
          if (!diff) return this.hasChanged() ? objToPaths(this.changed) : false;
          //</custom code>

          var old = this._changing ? this._previousAttributes : this.attributes;
          
          //<custom code>
          diff = objToPaths(diff);
          old = objToPaths(old);
          //</custom code>

          var val, changed = false;
          for (var attr in diff) {
            if (_.isEqual(old[attr], (val = diff[attr]))) continue;
            (changed || (changed = {}))[attr] = val;
          }
          return changed;
        },

        // Get the previous value of an attribute, recorded at the time the last
        // `"change"` event was fired.
        previous: function(attr) {
          if (attr == null || !this._previousAttributes) return null;

          //<custom code>
          return getNested(this._previousAttributes, attr);
          //</custom code>
        },

        // Get all of the attributes of the model at the time of the previous
        // `"change"` event.
        previousAttributes: function() {
          //<custom code>
          return _.deepClone(this._previousAttributes);
          //</custom code>
        }
    });


    //Config; override in your app to customise
    DeepModel.keyPathSeparator = '.';

    //Exports
    Backbone.DeepModel = DeepModel;

    //For use in NodeJS
    if (typeof module != 'undefined') module.exports = DeepModel;
    
    return Backbone;

}));