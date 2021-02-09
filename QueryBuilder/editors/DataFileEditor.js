///////////////////////////////////////////////////////////////////////////
// Copyright © Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define(['dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/html',
  'dojo/_base/array',
  'dojo/dom-style',
  'dojo/dom-attr',
  'dojo/on',
  'dojo/Deferred',
  'dojo/text!./DataFileEditor.html',
  'dijit/_TemplatedMixin',
  'dijit/_WidgetsInTemplateMixin',
  'esri/tasks/DataFile',
  'esri/request',
  'jimu/dijit/ViewStack',
  'jimu/dijit/Message',
  '../BaseEditor',
  '../gp_utils',
  'dijit/form/Form',
  'jimu/dijit/URLInput',
  'dijit/form/RadioButton'
  ], function(declare, lang, html, array, domStyle, domAttr, on, Deferred,
  template, _TemplatedMixin, _WidgetsInTemplateMixin, DataFile, esriRequest,
  ViewStack, Message, BaseEditor, utils){
  var URL_DELIMITER = 'url:';
  var ITEM_ID_DELIMITER = 'itemID:';
  var MODE_URL = 'url';
  var MODE_ITEM = 'item';

  return declare([BaseEditor, _TemplatedMixin, _WidgetsInTemplateMixin], {
    baseClass: 'jimu-gp-editor-base jimu-gp-editor-datafile',
    templateString: template,
    editorName: 'DataFileEditor',

    mode: MODE_URL,
    _url: '',
    _itemID: null,
    uniqueID: null,

    constructor: function(){
      this.inherited(arguments);

      this.uniqueID = utils.uniqueId();
    },

    postCreate: function(){
      this.inherited(arguments);

      if(this.value){
        this.parseDefaultValue();
      }

      //set url text input properties
      domAttr.set(this.urlEditor, 'tooltip', this.param.tooltip);

      if(this.context === 'setting'){
        this.viewStack = null;
        // Hide file uploader in setting panel.
        domStyle.set(this.fileNode, 'display', 'none');
      }else{
        this.viewStack = new ViewStack({
          viewType: 'dom',
          views: [this.urlNode, this.fileNode]
        });
        this.viewStack.placeAt(this.settingNode);
        this.viewStack.startup();
      }

      if(this.config.serverInfo.supportsUpload === true){
        //support url and upload file
        domStyle.set(this.modeSelection, 'display', '');
      }

      this.own(on(this.urlMode, 'click', lang.hitch(this, this._onUrlModeSelect)));
      this.own(on(this.itemMode, 'click', lang.hitch(this, this._onItemModeSelect)));

      if(this.mode === MODE_ITEM && this.config.serverInfo.supportsUpload){
        this.itemMode.set('checked', true);
        this._onItemModeSelect();
      }else{//MODE_URL or this.mdoe is null
        this.urlMode.set('checked', true);
        this._onUrlModeSelect();
        this.urlEditor.set('value', this._url);
      }

      // set filter for file input
      if (this.param.filter && this.param.filter.type && this.param.filter.type.toLowerCase() === 'file') {
        if (this.param.filter.list && this.param.filter.list.length > 0) {
          var suffixArray = array.map(this.param.filter.list, function(listItem) {
            return '.' + listItem;
          });
          html.setAttr(this.fileInput, 'accept', suffixArray.join(','));
        }
      }
    },

    parseDefaultValue: function(){
      if(this.value.indexOf(ITEM_ID_DELIMITER) === 0){
        this.mode = MODE_ITEM;
      }else{
        if(this.value.indexOf(URL_DELIMITER) === 0){
          this._url = this.value.substring(URL_DELIMITER.length);
        }
        this.mode = MODE_URL;
      }
    },

    hasValidValue: function(){
      if(this.mode === MODE_ITEM){
        return true;
      }else if(this.mode === MODE_URL){
        return this.urlEditor.isValid();
      }
    },

    getValue: function(){
      if(this.mode === MODE_URL){
        return URL_DELIMITER + this._getUrl();
      }else if(this.mode === MODE_ITEM){
        return ITEM_ID_DELIMITER;
      }else{
        return '';
      }
    },

    getGPValue: function(){
      var def = new Deferred();
      var dataFile = new DataFile();
      if(this.mode === MODE_URL){
        dataFile.url = this._getUrl();
      }else{
        dataFile.itemID = this.itemIDInput;
      }
      if(dataFile.url || dataFile.itemID){
        def.resolve(dataFile);
      }else{
        def.resolve(null);
      }
      return def;
    },

    _getUrl: function(){
      if(this.urlEditor.isValid()){
        return this.urlEditor.get('value');
      }else{
        return '';
      }
    },

    _onUrlModeSelect: function(){
      this.mode = MODE_URL;
      if(this.viewStack){
        this.viewStack.switchView(0);
      }else{
        domStyle.set(this.urlNode, "display", "block");
      }
    },

    _onItemModeSelect: function(){
      this.mode = MODE_ITEM;
      if(this.viewStack){
        this.viewStack.switchView(1);
      }else{
        domStyle.set(this.urlNode, "display", "none");
      }
    },

    _onUpload: function(){
      if(!domAttr.get(this.fileInput, 'value')){
        return;
      }
      this._doUpload().then(lang.hitch(this, function(success) {
        if(success){
          new Message({message:this.nls.uploadSuccess});
        }
      }), function(error) {
        var message = error.message || error;
        new Message({message: message});
      });
    },

    _doUpload: function() {
      var def = new Deferred();
      var fileName = domAttr.get(this.fileInput, 'value');
      fileName = fileName.replace(/\\/g, '/');
      fileName = fileName.substr(fileName.lastIndexOf('/') + 1);

      esriRequest({
        url: this.config.serverInfo.url + 'uploads/upload',
        form: this.fileForm.domNode,
        handleAs: 'json'
      }).then(lang.hitch(this, function(data) {
        if (data.success) {
          this.itemIDInput = data.item.itemID;
          domAttr.set(this.fileInput, 'value', '');
          domAttr.set(this.uploadFileName, 'innerHTML', fileName);
        }
        def.resolve(data.success);
      }), function(error) {
        def.reject(error);
      });

      return def;
    }
  });
});
