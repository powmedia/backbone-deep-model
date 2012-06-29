/**
 * Improves Backbone Model support when nested attributes are used.
 * get() and set() can take paths e.g. 'user.name'
 */
;(function(Backbone) {

    var defaultKeyPathSeparator = ".";

    /**
     * Takes a nested object and returns a shallow object keyed with the path names
     * e.g. { "level1.level2": "value" }
     * 
     * @param  {Object}      Nested object e.g. { level1: { level2: 'value' } }
     * @param  {String}      Delimiter between elements in the key path
     * @return {Object}      Shallow object with path names e.g. { 'level1.level2': 'value' }
     */
    function objToPaths(obj, keyPathSeparator) {
        var ret = {};

        for (var key in obj) {
            var val = obj[key];

            if (val && val.constructor === Object && !_.isEmpty(val)) {
                //Recursion for embedded objects
                var obj2 = objToPaths(val, keyPathSeparator);

                for (var key2 in obj2) {
                    var val2 = obj2[key2];
                    ret[key + (keyPathSeparator || defaultKeyPathSeparator) + key2] = val2;
                }
            } else {
                ret[key] = val;
            }
        }

        return ret;
    }

    /**
     * @param {Object}  Object to fetch attribute from
     * @param {String}  Object path e.g. 'user.name'
     * @param {String}  Delimiter between elements in the key path
     * @return {Mixed}
     */
    function getNested(obj, path, keyPathSeparator, return_exists) {
        var fields = path.split(keyPathSeparator || defaultKeyPathSeparator);
        var result = obj;
        return_exists || (return_exists = false)
        for (var i = 0, n = fields.length; i < n; i++) {
            if (return_exists
                && !_.has(result, fields[i]))
            {
                return false
            }
            result = result[fields[i]];
            
            if (typeof result === 'undefined') {
                if (return_exists)
                {
                    return true;
                }
                return result;
            }
        }
        if (return_exists)
        {
            return true;
        }
        return result;
    }
    
    /**
     * @param {Object} obj                Object to fetch attribute from
     * @param {String} path               Object path e.g. 'user.name'
     * @param {Object} [options]          Options
     * @param {Boolean} [options.unset]   Whether to delete the value
     * @param {Mixed}                     Value to set
     * @param {String}                    Delimiter between elements in the key path
     */
    function setNested(obj, path, val, keyPathSeparator, options) {
        options = options || {};

        var fields = path.split(keyPathSeparator || defaultKeyPathSeparator);
        var result = obj;
        for (var i = 0, n = fields.length; i < n; i++) {
            var field = fields[i];
            
            //If the last in the path, set the value
            if (i === n - 1) {
                options.unset ? delete result[field] : result[field] = val;
            } else {
                //Create the child object if it doesn't exist, or isn't an object
                if (typeof result[field] === 'undefined' || ! _.isObject(result[field])) {
                    result[field] = {};
                }
                
                //Move onto the next part of the path
                result = result[field];
            }
        }
    }

    function deleteNested(obj, path, keyPathSeparator) {
      setNested(obj, path, null, keyPathSeparator, { unset: true });
    }

    var DeepModel = Backbone.Model.extend({
       
        // Override get
        // Supports nested attributes via the syntax 'obj.attr' e.g. 'author.user.name'
        get: function(attr) {
            return getNested(this.attributes, attr, this.keyPathSeparator);
        },

        // Override set
        // Supports nested attributes via the syntax 'obj.attr' e.g. 'author.user.name'
        set: function(key, value, options) {
            //<custom code>
            var Model = Backbone.Model;
            //</custom code>

            var attrs, attr, val;

            // Handle both `"key", value` and `{key: value}` -style arguments.
            if (_.isObject(key) || key == null) {
                attrs = key;
                options = value;
            } else {
                attrs = {};
                attrs[key] = value;
            }

            // Extract attributes and options.
            options || (options = {});
            if (!attrs) return this;
            if (attrs instanceof Model) attrs = attrs.attributes;
            if (options.unset) for (attr in attrs) attrs[attr] = void 0;

            // Run validation.
            if (!this._validate(attrs, options)) return false;

            // Check for changes of `id`.
            if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

            var changes = options.changes = {};
            var now = this.attributes;
            var escaped = this._escapedAttributes;
            var prev = this._previousAttributes || {};

            
            // <custom code>
            attrs = objToPaths(attrs, this.keyPathSeparator);

            // For each `set` attribute...
            for (attr in attrs) {
              val = attrs[attr];

              var currentValue = getNested(now, attr, this.keyPathSeparator),
                  previousValue = getNested(prev, attr, this.keyPathSeparator),
                  escapedValue = getNested(escaped, attr, this.keyPathSeparator),
                  hasCurrentValue = _.isUndefined(currentValue),
                  hasPreviousValue = _.isUndefined(previousValue);

              // If the new and current value differ, record the change.
              if (!_.isEqual(currentValue, val) || (options.unset && hasCurrentValue)) {
                deleteNested(escaped, attr, this.keyPathSeparator);
                setNested((options.silent ? this._silent : changes), attr, true, this.keyPathSeparator);
              }

              // Update or delete the current value.
              options.unset ? deleteNested(now, attr, this.keyPathSeparator) : setNested(now, attr, val, this.keyPathSeparator);

              // If the new and previous value differ, record the change.  If not,
              // then remove changes for this attribute.
              if (!_.isEqual(previousValue, val) || (hasCurrentValue != hasPreviousValue)) {
                setNested(this.changed, attr, val, this.keyPathSeparator);
                if (!options.silent) setNested(this._pending, attr, true, this.keyPathSeparator);
              } else {
                deleteNested(this.changed, attr, this.keyPathSeparator);
                deleteNested(this._pending, attr, this.keyPathSeparator);
              }
            }

            // Fire the `"change"` events.
            if (!options.silent) this.change(options);
            return this;
        },

        // Override has
        has: function(attr) {
            return getNested(this.attributes, attr, this.keyPathSeparator) != null;
        },

        // Override change
        change: function(options) {
          options || (options = {});
          var changing = this._changing;
          this._changing = true;

          // Silent changes become pending changes.
          for (var attr in objToPaths(this._silent, this.keyPathSeparator)) setNested(this._pending, attr, true, this.keyPathSeparator);

          // Silent changes are triggered.
          var changes = _.extend({}, options.changes, this._silent);
          this._silent = {};
          for (var attr in objToPaths(changes, this.keyPathSeparator)) {
            this.trigger('change:' + attr, this, this.get(attr), options);
          }
          if (changing) return this;

          // Continue firing `"change"` events while there are pending changes.
          while (!_.isEmpty(this._pending)) {
            this._pending = {};
            this.trigger('change', this, options);
            // Pending and silent changes still remain.
            for (var attr in objToPaths(this.changed, this.keyPathSeparator)) {
              if (getNested(this._pending, attr, this.keyPathSeparator) || getNested(this._silent, attr, this.keyPathSeparator)) continue;
              deleteNested(this.change, attr, this.keyPathSeparator);
            }
            this._previousAttributes = _.clone(this.attributes);
          }

          this._changing = false;
          return this;
        },

        changedAttributes: function(diff) {
          if (!diff) return this.hasChanged() ? _.clone(objToPaths(this.changed, this.keyPathSeparator)) : false;
          var val, changed = false, old = this._previousAttributes;
          for (var attr in diff) {
            if (_.isEqual(old[attr], (val = diff[attr]))) continue;
            (changed || (changed = {}))[attr] = val;
          }
          return changed;
        },

    });
    
    
    //Exports
    Backbone.DeepModel = DeepModel;

    //For use in NodeJS
    if (typeof module != 'undefined') module.exports = DeepModel;
    
})(Backbone);
