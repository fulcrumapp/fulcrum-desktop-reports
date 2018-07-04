'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _fulcrumDesktopPlugin = require('fulcrum-desktop-plugin');

var _concurrentQueue = require('./concurrent-queue');

var _concurrentQueue2 = _interopRequireDefault(_concurrentQueue);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

exports.default = class {
  constructor() {
    var _this = this;

    this.runCommand = _asyncToGenerator(function* () {
      yield _this.activate();

      const account = yield fulcrum.fetchAccount(fulcrum.args.org);

      const skipForms = fulcrum.args.reportsSkip || [];
      const includeForms = fulcrum.args.form != null ? fulcrum.args.form : null;

      if (account) {
        _this.account = account;

        const forms = yield account.findForms({});

        const concurrency = Math.min(Math.max(1, fulcrum.args.reportsConcurrency || 5), 50);

        _this.queue = new _concurrentQueue2.default(_this.workerFunction, concurrency);

        for (const form of forms) {
          if (skipForms.indexOf(form.name) > -1) {
            continue;
          }

          if (includeForms && includeForms.indexOf(form.name) === -1) {
            continue;
          }

          yield form.findEachRecord({}, (() => {
            var _ref2 = _asyncToGenerator(function* (record) {
              _this.queue.push({ id: record.rowID });
            });

            return function (_x) {
              return _ref2.apply(this, arguments);
            };
          })());
        }

        yield _this.queue.drain();
      } else {
        console.error('Unable to find account', fulcrum.args.org);
      }
    });

    this.workerFunction = (() => {
      var _ref3 = _asyncToGenerator(function* (task) {
        try {
          const record = yield _this.account.findFirstRecord({ id: task.id });

          yield record.getForm();

          yield _this.runReport({ record });
        } catch (err) {
          console.error('Error', err);
        }
      });

      return function (_x2) {
        return _ref3.apply(this, arguments);
      };
    })();

    this.onRecordSave = (() => {
      var _ref4 = _asyncToGenerator(function* ({ record }) {
        _this.runReport({ record });
      });

      return function (_x3) {
        return _ref4.apply(this, arguments);
      };
    })();

    this.runReport = (() => {
      var _ref5 = _asyncToGenerator(function* ({ record, template, header, footer, cover }) {
        const fileName = _this.reportsFileName === 'title' ? record.displayValue || record.id : record.id;

        const outputFileName = _path2.default.join(_this.reportsPath, fileName + '.pdf');

        if (_fs2.default.existsSync(outputFileName) && _fs2.default.statSync(outputFileName).size > 0) {
          return;
        }

        const params = {
          reportName: fileName,
          directory: _this.reportsPath,
          template: template || _this.template,
          header: header || _this.header,
          footer: footer || _this.footer,
          cover,
          data: {
            DateUtils: _fulcrumDesktopPlugin.core.DateUtils,
            record: record,
            renderValues: _this.renderValues,
            getPhotoURL: _this.getPhotoURL
          },
          ejsOptions: {},
          reportOptions: {
            wkhtmltopdf: fulcrum.args.reportsWkhtmltopdf
          }
        };

        yield _this.generatePDF(params);

        if (fulcrum.args.reportsRepeatables) {
          for (const item of record.formValues.repeatableItems) {
            const repeatableFileName = _this.reportsFileName === 'title' ? `${fileName} - ${item.displayValue}` : item.id;

            params.reportName = repeatableFileName;
            params.data.record = item;

            yield _this.generatePDF(params);
          }
        }
      });

      return function (_x4) {
        return _ref5.apply(this, arguments);
      };
    })();

    this.getPhotoURL = item => {
      if (fulcrum.args.reportsMediaPath) {
        return _path2.default.join(fulcrum.args.reportsMediaPath, 'photos', item.mediaID + '.jpg');
      }

      const url = _fulcrumDesktopPlugin.APIClient.getPhotoURL(this.account, { id: item.mediaID }).replace('?', '/large?');

      if (url.indexOf('.jpg') === -1) {
        return url.replace('?', '.jpg?');
      }

      return url;
    };

    this.renderValues = (feature, renderFunction) => {
      return this.renderValuesRecursive(feature, feature.formValues.container.elements, renderFunction);
    };

    this.renderValuesRecursive = (feature, elements, renderFunction) => {
      for (const element of elements) {
        const formValue = feature.formValues.get(element.key);

        renderFunction(element, formValue);

        if (element.isSectionElement) {
          this.renderValuesRecursive(feature, element.elements, renderFunction);
        } else if (element.isRepeatableElement) {
          let shouldRecurse = true;

          if (element.isRepeatableElement && fulcrum.args.reportsRecurse === false) {
            shouldRecurse = false;
          }

          if (formValue && shouldRecurse) {
            for (const item of formValue.items) {
              this.renderValuesRecursive(item, element.elements, renderFunction);
            }
          }
        }
      }
    };
  }

  task(cli) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      return cli.command({
        command: 'reports',
        desc: 'run the pdf reports sync for a specific organization',
        builder: {
          org: {
            desc: 'organization name',
            required: true,
            type: 'string'
          },
          form: {
            desc: 'form name',
            type: 'array'
          },
          reportsSkip: {
            desc: 'skip form name',
            type: 'array'
          },
          reportsTemplate: {
            desc: 'path to ejs template file',
            type: 'string'
          },
          reportsHeader: {
            desc: 'path to header ejs template file',
            type: 'string'
          },
          reportsFooter: {
            desc: 'path to footer ejs template file',
            type: 'string'
          },
          reportsPath: {
            desc: 'report storage directory',
            type: 'string'
          },
          reportsMediaPath: {
            desc: 'media storage directory',
            type: 'string'
          },
          reportsFileName: {
            desc: 'file name',
            type: 'string'
          },
          reportsConcurrency: {
            desc: 'concurrent reports (between 1 and 10)',
            type: 'number',
            default: 5
          },
          reportsRepeatables: {
            desc: 'generate a PDF for each repeatable child record',
            type: 'boolean',
            default: false
          },
          reportsRecurse: {
            desc: 'recursively print all child items in each PDF',
            type: 'boolean',
            default: true
          },
          reportsWkhtmltopdf: {
            desc: 'path to wkhtmltopdf binary',
            type: 'string'
          }
        },
        handler: _this2.runCommand
      });
    })();
  }

  activate() {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      const templateFile = fulcrum.args.reportsTemplate || _path2.default.join(__dirname, 'template.ejs');

      _this3.template = _fs2.default.readFileSync(templateFile).toString();

      if (fulcrum.args.reportsHeader) {
        _this3.header = _fs2.default.readFileSync(fulcrum.args.reportsHeader).toString();
      }

      if (fulcrum.args.reportsFooter) {
        _this3.footer = _fs2.default.readFileSync(fulcrum.args.reportsFooter).toString();
      }

      _this3.reportsPath = fulcrum.args.reportsPath || fulcrum.dir('reports');
      _this3.reportsFileName = fulcrum.args.reportsFileName === 'title' ? 'title' : 'id';

      _mkdirp2.default.sync(_this3.reportsPath);
      // fulcrum.on('record:save', this.onRecordSave);
    })();
  }

  generatePDF(params) {
    return _asyncToGenerator(function* () {
      console.log('Generating', params.data.record.isRecord ? 'record'.green : 'child record'.green, params.reportName);
      return yield _fulcrumDesktopPlugin.ReportGenerator.generate(params);
    })();
  }

};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJydW5Db21tYW5kIiwiYWN0aXZhdGUiLCJhY2NvdW50IiwiZnVsY3J1bSIsImZldGNoQWNjb3VudCIsImFyZ3MiLCJvcmciLCJza2lwRm9ybXMiLCJyZXBvcnRzU2tpcCIsImluY2x1ZGVGb3JtcyIsImZvcm0iLCJmb3JtcyIsImZpbmRGb3JtcyIsImNvbmN1cnJlbmN5IiwiTWF0aCIsIm1pbiIsIm1heCIsInJlcG9ydHNDb25jdXJyZW5jeSIsInF1ZXVlIiwid29ya2VyRnVuY3Rpb24iLCJpbmRleE9mIiwibmFtZSIsImZpbmRFYWNoUmVjb3JkIiwicmVjb3JkIiwicHVzaCIsImlkIiwicm93SUQiLCJkcmFpbiIsImNvbnNvbGUiLCJlcnJvciIsInRhc2siLCJmaW5kRmlyc3RSZWNvcmQiLCJnZXRGb3JtIiwicnVuUmVwb3J0IiwiZXJyIiwib25SZWNvcmRTYXZlIiwidGVtcGxhdGUiLCJoZWFkZXIiLCJmb290ZXIiLCJjb3ZlciIsImZpbGVOYW1lIiwicmVwb3J0c0ZpbGVOYW1lIiwiZGlzcGxheVZhbHVlIiwib3V0cHV0RmlsZU5hbWUiLCJqb2luIiwicmVwb3J0c1BhdGgiLCJleGlzdHNTeW5jIiwic3RhdFN5bmMiLCJzaXplIiwicGFyYW1zIiwicmVwb3J0TmFtZSIsImRpcmVjdG9yeSIsImRhdGEiLCJEYXRlVXRpbHMiLCJyZW5kZXJWYWx1ZXMiLCJnZXRQaG90b1VSTCIsImVqc09wdGlvbnMiLCJyZXBvcnRPcHRpb25zIiwid2todG1sdG9wZGYiLCJyZXBvcnRzV2todG1sdG9wZGYiLCJnZW5lcmF0ZVBERiIsInJlcG9ydHNSZXBlYXRhYmxlcyIsIml0ZW0iLCJmb3JtVmFsdWVzIiwicmVwZWF0YWJsZUl0ZW1zIiwicmVwZWF0YWJsZUZpbGVOYW1lIiwicmVwb3J0c01lZGlhUGF0aCIsIm1lZGlhSUQiLCJ1cmwiLCJyZXBsYWNlIiwiZmVhdHVyZSIsInJlbmRlckZ1bmN0aW9uIiwicmVuZGVyVmFsdWVzUmVjdXJzaXZlIiwiY29udGFpbmVyIiwiZWxlbWVudHMiLCJlbGVtZW50IiwiZm9ybVZhbHVlIiwiZ2V0Iiwia2V5IiwiaXNTZWN0aW9uRWxlbWVudCIsImlzUmVwZWF0YWJsZUVsZW1lbnQiLCJzaG91bGRSZWN1cnNlIiwicmVwb3J0c1JlY3Vyc2UiLCJpdGVtcyIsImNsaSIsImNvbW1hbmQiLCJkZXNjIiwiYnVpbGRlciIsInJlcXVpcmVkIiwidHlwZSIsInJlcG9ydHNUZW1wbGF0ZSIsInJlcG9ydHNIZWFkZXIiLCJyZXBvcnRzRm9vdGVyIiwiZGVmYXVsdCIsImhhbmRsZXIiLCJ0ZW1wbGF0ZUZpbGUiLCJfX2Rpcm5hbWUiLCJyZWFkRmlsZVN5bmMiLCJ0b1N0cmluZyIsImRpciIsInN5bmMiLCJsb2ciLCJpc1JlY29yZCIsImdyZWVuIiwiZ2VuZXJhdGUiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOztBQUNBOzs7Ozs7OztrQkFFZSxNQUFNO0FBQUE7QUFBQTs7QUFBQSxTQW1FbkJBLFVBbkVtQixxQkFtRU4sYUFBWTtBQUN2QixZQUFNLE1BQUtDLFFBQUwsRUFBTjs7QUFFQSxZQUFNQyxVQUFVLE1BQU1DLFFBQVFDLFlBQVIsQ0FBcUJELFFBQVFFLElBQVIsQ0FBYUMsR0FBbEMsQ0FBdEI7O0FBRUEsWUFBTUMsWUFBWUosUUFBUUUsSUFBUixDQUFhRyxXQUFiLElBQTRCLEVBQTlDO0FBQ0EsWUFBTUMsZUFBZU4sUUFBUUUsSUFBUixDQUFhSyxJQUFiLElBQXFCLElBQXJCLEdBQTRCUCxRQUFRRSxJQUFSLENBQWFLLElBQXpDLEdBQWdELElBQXJFOztBQUVBLFVBQUlSLE9BQUosRUFBYTtBQUNYLGNBQUtBLE9BQUwsR0FBZUEsT0FBZjs7QUFFQSxjQUFNUyxRQUFRLE1BQU1ULFFBQVFVLFNBQVIsQ0FBa0IsRUFBbEIsQ0FBcEI7O0FBRUEsY0FBTUMsY0FBY0MsS0FBS0MsR0FBTCxDQUFTRCxLQUFLRSxHQUFMLENBQVMsQ0FBVCxFQUFZYixRQUFRRSxJ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bnQiOlsiaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IG1rZGlycCBmcm9tICdta2RpcnAnO1xuaW1wb3J0IHsgUmVwb3J0R2VuZXJhdG9yLCBBUElDbGllbnQsIGNvcmUgfSBmcm9tICdmdWxjcnVtJztcbmltcG9ydCBDb25jdXJyZW50UXVldWUgZnJvbSAnLi9jb25jdXJyZW50LXF1ZXVlJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3Mge1xuICBhc3luYyB0YXNrKGNsaSkge1xuICAgIHJldHVybiBjbGkuY29tbWFuZCh7XG4gICAgICBjb21tYW5kOiAncmVwb3J0cycsXG4gICAgICBkZXNjOiAncnVuIHRoZSBwZGYgcmVwb3J0cyBzeW5jIGZvciBhIHNwZWNpZmljIG9yZ2FuaXphdGlvbicsXG4gICAgICBidWlsZGVyOiB7XG4gICAgICAgIG9yZzoge1xuICAgICAgICAgIGRlc2M6ICdvcmdhbml6YXRpb24gbmFtZScsXG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgZm9ybToge1xuICAgICAgICAgIGRlc2M6ICdmb3JtIG5hbWUnLFxuICAgICAgICAgIHR5cGU6ICdhcnJheSdcbiAgICAgICAgfSxcbiAgICAgICAgcmVwb3J0c1NraXA6IHtcbiAgICAgICAgICBkZXNjOiAnc2tpcCBmb3JtIG5hbWUnLFxuICAgICAgICAgIHR5cGU6ICdhcnJheSdcbiAgICAgICAgfSxcbiAgICAgICAgcmVwb3J0c1RlbXBsYXRlOiB7XG4gICAgICAgICAgZGVzYzogJ3BhdGggdG8gZWpzIHRlbXBsYXRlIGZpbGUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIHJlcG9ydHNIZWFkZXI6IHtcbiAgICAgICAgICBkZXNjOiAncGF0aCB0byBoZWFkZXIgZWpzIHRlbXBsYXRlIGZpbGUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIHJlcG9ydHNGb290ZXI6IHtcbiAgICAgICAgICBkZXNjOiAncGF0aCB0byBmb290ZXIgZWpzIHRlbXBsYXRlIGZpbGUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIHJlcG9ydHNQYXRoOiB7XG4gICAgICAgICAgZGVzYzogJ3JlcG9ydCBzdG9yYWdlIGRpcmVjdG9yeScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgcmVwb3J0c01lZGlhUGF0aDoge1xuICAgICAgICAgIGRlc2M6ICdtZWRpYSBzdG9yYWdlIGRpcmVjdG9yeScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgcmVwb3J0c0ZpbGVOYW1lOiB7XG4gICAgICAgICAgZGVzYzogJ2ZpbGUgbmFtZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgcmVwb3J0c0NvbmN1cnJlbmN5OiB7XG4gICAgICAgICAgZGVzYzogJ2NvbmN1cnJlbnQgcmVwb3J0cyAoYmV0d2VlbiAxIGFuZCAxMCknLFxuICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgIGRlZmF1bHQ6IDVcbiAgICAgICAgfSxcbiAgICAgICAgcmVwb3J0c1JlcGVhdGFibGVzOiB7XG4gICAgICAgICAgZGVzYzogJ2dlbmVyYXRlIGEgUERGIGZvciBlYWNoIHJlcGVhdGFibGUgY2hpbGQgcmVjb3JkJyxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgfSxcbiAgICAgICAgcmVwb3J0c1JlY3Vyc2U6IHtcbiAgICAgICAgICBkZXNjOiAncmVjdXJzaXZlbHkgcHJpbnQgYWxsIGNoaWxkIGl0ZW1zIGluIGVhY2ggUERGJyxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICByZXBvcnRzV2todG1sdG9wZGY6IHtcbiAgICAgICAgICBkZXNjOiAncGF0aCB0byB3a2h0bWx0b3BkZiBiaW5hcnknLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBoYW5kbGVyOiB0aGlzLnJ1bkNvbW1hbmRcbiAgICB9KTtcbiAgfVxuXG4gIHJ1bkNvbW1hbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgdGhpcy5hY3RpdmF0ZSgpO1xuXG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGZ1bGNydW0uZmV0Y2hBY2NvdW50KGZ1bGNydW0uYXJncy5vcmcpO1xuXG4gICAgY29uc3Qgc2tpcEZvcm1zID0gZnVsY3J1bS5hcmdzLnJlcG9ydHNTa2lwIHx8IFtdO1xuICAgIGNvbnN0IGluY2x1ZGVGb3JtcyA9IGZ1bGNydW0uYXJncy5mb3JtICE9IG51bGwgPyBmdWxjcnVtLmFyZ3MuZm9ybSA6IG51bGw7XG5cbiAgICBpZiAoYWNjb3VudCkge1xuICAgICAgdGhpcy5hY2NvdW50ID0gYWNjb3VudDtcblxuICAgICAgY29uc3QgZm9ybXMgPSBhd2FpdCBhY2NvdW50LmZpbmRGb3Jtcyh7fSk7XG5cbiAgICAgIGNvbnN0IGNvbmN1cnJlbmN5ID0gTWF0aC5taW4oTWF0aC5tYXgoMSwgZnVsY3J1bS5hcmdzLnJlcG9ydHNDb25jdXJyZW5jeSB8fCA1KSwgNTApO1xuXG4gICAgICB0aGlzLnF1ZXVlID0gbmV3IENvbmN1cnJlbnRRdWV1ZSh0aGlzLndvcmtlckZ1bmN0aW9uLCBjb25jdXJyZW5jeSk7XG5cbiAgICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xuICAgICAgICBpZiAoc2tpcEZvcm1zLmluZGV4T2YoZm9ybS5uYW1lKSA+IC0xKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5jbHVkZUZvcm1zICYmIGluY2x1ZGVGb3Jtcy5pbmRleE9mKGZvcm0ubmFtZSkgPT09IC0xKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCBmb3JtLmZpbmRFYWNoUmVjb3JkKHt9LCBhc3luYyAocmVjb3JkKSA9PiB7XG4gICAgICAgICAgdGhpcy5xdWV1ZS5wdXNoKHtpZDogcmVjb3JkLnJvd0lEfSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnF1ZXVlLmRyYWluKCk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcignVW5hYmxlIHRvIGZpbmQgYWNjb3VudCcsIGZ1bGNydW0uYXJncy5vcmcpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGFjdGl2YXRlKCkge1xuICAgIGNvbnN0IHRlbXBsYXRlRmlsZSA9IGZ1bGNydW0uYXJncy5yZXBvcnRzVGVtcGxhdGUgfHwgcGF0aC5qb2luKF9fZGlybmFtZSwgJ3RlbXBsYXRlLmVqcycpO1xuXG4gICAgdGhpcy50ZW1wbGF0ZSA9IGZzLnJlYWRGaWxlU3luYyh0ZW1wbGF0ZUZpbGUpLnRvU3RyaW5nKCk7XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLnJlcG9ydHNIZWFkZXIpIHtcbiAgICAgIHRoaXMuaGVhZGVyID0gZnMucmVhZEZpbGVTeW5jKGZ1bGNydW0uYXJncy5yZXBvcnRzSGVhZGVyKS50b1N0cmluZygpO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MucmVwb3J0c0Zvb3Rlcikge1xuICAgICAgdGhpcy5mb290ZXIgPSBmcy5yZWFkRmlsZVN5bmMoZnVsY3J1bS5hcmdzLnJlcG9ydHNGb290ZXIpLnRvU3RyaW5nKCk7XG4gICAgfVxuXG4gICAgdGhpcy5yZXBvcnRzUGF0aCA9IGZ1bGNydW0uYXJncy5yZXBvcnRzUGF0aCB8fCBmdWxjcnVtLmRpcigncmVwb3J0cycpO1xuICAgIHRoaXMucmVwb3J0c0ZpbGVOYW1lID0gZnVsY3J1bS5hcmdzLnJlcG9ydHNGaWxlTmFtZSA9PT0gJ3RpdGxlJyA/ICd0aXRsZScgOiAnaWQnO1xuXG4gICAgbWtkaXJwLnN5bmModGhpcy5yZXBvcnRzUGF0aCk7XG4gICAgLy8gZnVsY3J1bS5vbigncmVjb3JkOnNhdmUnLCB0aGlzLm9uUmVjb3JkU2F2ZSk7XG4gIH1cblxuICB3b3JrZXJGdW5jdGlvbiA9IGFzeW5jICh0YXNrKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlY29yZCA9IGF3YWl0IHRoaXMuYWNjb3VudC5maW5kRmlyc3RSZWNvcmQoe2lkOiB0YXNrLmlkfSk7XG5cbiAgICAgIGF3YWl0IHJlY29yZC5nZXRGb3JtKCk7XG5cbiAgICAgIGF3YWl0IHRoaXMucnVuUmVwb3J0KHtyZWNvcmR9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yJywgZXJyKTtcbiAgICB9XG4gIH1cblxuICBvblJlY29yZFNhdmUgPSBhc3luYyAoe3JlY29yZH0pID0+IHtcbiAgICB0aGlzLnJ1blJlcG9ydCh7cmVjb3JkfSk7XG4gIH1cblxuICBydW5SZXBvcnQgPSBhc3luYyAoe3JlY29yZCwgdGVtcGxhdGUsIGhlYWRlciwgZm9vdGVyLCBjb3Zlcn0pID0+IHtcbiAgICBjb25zdCBmaWxlTmFtZSA9IHRoaXMucmVwb3J0c0ZpbGVOYW1lID09PSAndGl0bGUnID8gcmVjb3JkLmRpc3BsYXlWYWx1ZSB8fCByZWNvcmQuaWQgOiByZWNvcmQuaWQ7XG5cbiAgICBjb25zdCBvdXRwdXRGaWxlTmFtZSA9IHBhdGguam9pbih0aGlzLnJlcG9ydHNQYXRoLCBmaWxlTmFtZSArICcucGRmJyk7XG5cbiAgICBpZiAoZnMuZXhpc3RzU3luYyhvdXRwdXRGaWxlTmFtZSkgJiYgZnMuc3RhdFN5bmMob3V0cHV0RmlsZU5hbWUpLnNpemUgPiAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgcmVwb3J0TmFtZTogZmlsZU5hbWUsXG4gICAgICBkaXJlY3Rvcnk6IHRoaXMucmVwb3J0c1BhdGgsXG4gICAgICB0ZW1wbGF0ZTogdGVtcGxhdGUgfHwgdGhpcy50ZW1wbGF0ZSxcbiAgICAgIGhlYWRlcjogaGVhZGVyIHx8IHRoaXMuaGVhZGVyLFxuICAgICAgZm9vdGVyOiBmb290ZXIgfHwgdGhpcy5mb290ZXIsXG4gICAgICBjb3ZlcixcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgRGF0ZVV0aWxzOiBjb3JlLkRhdGVVdGlscyxcbiAgICAgICAgcmVjb3JkOiByZWNvcmQsXG4gICAgICAgIHJlbmRlclZhbHVlczogdGhpcy5yZW5kZXJWYWx1ZXMsXG4gICAgICAgIGdldFBob3RvVVJMOiB0aGlzLmdldFBob3RvVVJMXG4gICAgICB9LFxuICAgICAgZWpzT3B0aW9uczoge30sXG4gICAgICByZXBvcnRPcHRpb25zOiB7XG4gICAgICAgIHdraHRtbHRvcGRmOiBmdWxjcnVtLmFyZ3MucmVwb3J0c1draHRtbHRvcGRmXG4gICAgICB9XG4gICAgfTtcblxuICAgIGF3YWl0IHRoaXMuZ2VuZXJhdGVQREYocGFyYW1zKTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MucmVwb3J0c1JlcGVhdGFibGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgcmVjb3JkLmZvcm1WYWx1ZXMucmVwZWF0YWJsZUl0ZW1zKSB7XG4gICAgICAgIGNvbnN0IHJlcGVhdGFibGVGaWxlTmFtZSA9IHRoaXMucmVwb3J0c0ZpbGVOYW1lID09PSAndGl0bGUnID8gYCR7ZmlsZU5hbWV9IC0gJHtpdGVtLmRpc3BsYXlWYWx1ZX1gIDogaXRlbS5pZDtcblxuICAgICAgICBwYXJhbXMucmVwb3J0TmFtZSA9IHJlcGVhdGFibGVGaWxlTmFtZTtcbiAgICAgICAgcGFyYW1zLmRhdGEucmVjb3JkID0gaXRlbTtcblxuICAgICAgICBhd2FpdCB0aGlzLmdlbmVyYXRlUERGKHBhcmFtcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZ2VuZXJhdGVQREYocGFyYW1zKSB7XG4gICAgY29uc29sZS5sb2coJ0dlbmVyYXRpbmcnLCBwYXJhbXMuZGF0YS5yZWNvcmQuaXNSZWNvcmQgPyAncmVjb3JkJy5ncmVlbiA6ICdjaGlsZCByZWNvcmQnLmdyZWVuLCBwYXJhbXMucmVwb3J0TmFtZSk7XG4gICAgcmV0dXJuIGF3YWl0IFJlcG9ydEdlbmVyYXRvci5nZW5lcmF0ZShwYXJhbXMpO1xuICB9XG5cbiAgZ2V0UGhvdG9VUkwgPSAoaXRlbSkgPT4ge1xuICAgIGlmIChmdWxjcnVtLmFyZ3MucmVwb3J0c01lZGlhUGF0aCkge1xuICAgICAgcmV0dXJuIHBhdGguam9pbihmdWxjcnVtLmFyZ3MucmVwb3J0c01lZGlhUGF0aCwgJ3Bob3RvcycsIGl0ZW0ubWVkaWFJRCArICcuanBnJyk7XG4gICAgfVxuXG4gICAgY29uc3QgdXJsID0gQVBJQ2xpZW50LmdldFBob3RvVVJMKHRoaXMuYWNjb3VudCwge2lkOiBpdGVtLm1lZGlhSUR9KS5yZXBsYWNlKCc/JywgJy9sYXJnZT8nKTtcblxuICAgIGlmICh1cmwuaW5kZXhPZignLmpwZycpID09PSAtMSkge1xuICAgICAgcmV0dXJuIHVybC5yZXBsYWNlKCc/JywgJy5qcGc/Jyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHVybDtcbiAgfVxuXG4gIHJlbmRlclZhbHVlcyA9IChmZWF0dXJlLCByZW5kZXJGdW5jdGlvbikgPT4ge1xuICAgIHJldHVybiB0aGlzLnJlbmRlclZhbHVlc1JlY3Vyc2l2ZShmZWF0dXJlLCBmZWF0dXJlLmZvcm1WYWx1ZXMuY29udGFpbmVyLmVsZW1lbnRzLCByZW5kZXJGdW5jdGlvbik7XG4gIH1cblxuICByZW5kZXJWYWx1ZXNSZWN1cnNpdmUgPSAoZmVhdHVyZSwgZWxlbWVudHMsIHJlbmRlckZ1bmN0aW9uKSA9PiB7XG4gICAgZm9yIChjb25zdCBlbGVtZW50IG9mIGVsZW1lbnRzKSB7XG4gICAgICBjb25zdCBmb3JtVmFsdWUgPSBmZWF0dXJlLmZvcm1WYWx1ZXMuZ2V0KGVsZW1lbnQua2V5KTtcblxuICAgICAgcmVuZGVyRnVuY3Rpb24oZWxlbWVudCwgZm9ybVZhbHVlKTtcblxuICAgICAgaWYgKGVsZW1lbnQuaXNTZWN0aW9uRWxlbWVudCkge1xuICAgICAgICB0aGlzLnJlbmRlclZhbHVlc1JlY3Vyc2l2ZShmZWF0dXJlLCBlbGVtZW50LmVsZW1lbnRzLCByZW5kZXJGdW5jdGlvbik7XG4gICAgICB9IGVsc2UgaWYgKGVsZW1lbnQuaXNSZXBlYXRhYmxlRWxlbWVudCkge1xuICAgICAgICBsZXQgc2hvdWxkUmVjdXJzZSA9IHRydWU7XG5cbiAgICAgICAgaWYgKGVsZW1lbnQuaXNSZXBlYXRhYmxlRWxlbWVudCAmJiBmdWxjcnVtLmFyZ3MucmVwb3J0c1JlY3Vyc2UgPT09IGZhbHNlKSB7XG4gICAgICAgICAgc2hvdWxkUmVjdXJzZSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZvcm1WYWx1ZSAmJiBzaG91bGRSZWN1cnNlKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGZvcm1WYWx1ZS5pdGVtcykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJWYWx1ZXNSZWN1cnNpdmUoaXRlbSwgZWxlbWVudC5lbGVtZW50cywgcmVuZGVyRnVuY3Rpb24pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19