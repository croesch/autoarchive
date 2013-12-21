// Opera Wang, 2013/5/1
// GPL V3 / MPL
"use strict";
var EXPORTED_SYMBOLS = ["autoArchivePref"];
const { classes: Cc, Constructor: CC, interfaces: Ci, utils: Cu, results: Cr, manager: Cm } = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("chrome://autoArchive/content/log.jsm");
const mozIJSSubScriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);

let autoArchivePref = {
  path: null,
  // TODO: When bug 564675 is implemented this will no longer be needed
  // Always set the default prefs, because they disappear on restart
  setDefaultPrefs: function () {
    let branch = Services.prefs.getDefaultBranch("");
    let prefLoaderScope = {
      pref: function(key, val) {
        switch (typeof val) {
          case "boolean":
            branch.setBoolPref(key, val);
            break;
          case "number":
            branch.setIntPref(key, val);
            break;
          case "string":
            branch.setCharPref(key, val);
            break;
        }
      }
    };
    let uri = Services.io.newURI("defaults/preferences/prefs.js", null, Services.io.newURI(this.path, null, null));
    try {
      mozIJSSubScriptLoader.loadSubScript(uri.spec, prefLoaderScope);
    } catch (err) {
      Cu.reportError(err);
    }
  },
  options: {},
  cleanup: function() {
    this.prefs.removeObserver("", this, false);
  },
  initPerf: function(spec) {
    this.path = spec.replace(/bootstrap\.js$/, '');
    this.setDefaultPrefs();
    this.prefs = Services.prefs.getBranch(this.prefPath);
    this.prefs.addObserver("", this, false);
    let self = this;
    this.allPrefs.forEach( function(key) {
      self.observe('', 'nsPref:changed', key); // we fake one
    } );
  },

  prefPath: "extensions.awsome_auto_archive.",
  allPrefs: ['enable_verbose_info', 'rules', 'enable_flag', 'enable_tag', 'startup_delay', 'idle_delay', 'start_next_delay', 'default_days'],
  rules: [],
  observe: function(subject, topic, data) {
    try {
      if (topic != "nsPref:changed") return;
      switch(data) {
        case "enable_verbose_info":
        case "enable_flag":
        case "enable_tag":
          this.options[data] = this.prefs.getBoolPref(data);
          break;
        case "rules":
          this.options[data] = this.prefs.getCharPref(data);
          break;
        default:
          this.options[data] = this.prefs.getIntPref(data);
          break;
      }
      if ( data == 'enable_verbose_info' ) {
        autoArchiveLog.setVerbose(this.options.enable_verbose_info);
      } else if ( data == 'rules' ) {
        this.rules = JSON.parse(this.options.rules);
        autoArchiveLog.logObject(this.rules,'rules',1);
        this.rules.forEach( function(rule) {
          let error = false;
          ["src", "action", "age", "sub", "enable"].forEach( function(att) {
            if ( typeof(rule[att]) == 'undefined' ) {
              autoArchiveLog.log("Error: rule lacks of property " + att, 1);
              error = true;
            }
          } );
          if ( ["move", "archive", "copy", "delete"].indexOf(rule.action) < 0 ) {
            autoArchiveLog.log("Error: rule action must be one of move or archive", 1);
            error = true;
          }
          if ( ["move", "copy"].indexOf(rule.action) >= 0 && typeof(rule.dest) == 'undefined' ) {
            autoArchiveLog.log("Error: dest folder must be defined for move action", 1);
            error = true;
          }
          if ( error ) rule.enable = false;
        } );
      }
    } catch (err) {
      autoArchiveLog.logException(err);
    };
  },
};