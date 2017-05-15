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

      if (account) {
        _this.account = account;

        const form = yield account.findFirstForm({ name: fulcrum.args.form });

        const records = yield form.findRecordsBySQL(fulcrum.args.where);

        const concurrency = Math.min(Math.max(1, fulcrum.args.concurrency || 5), 10);

        _this.queue = new _concurrentQueue2.default(_this.workerFunction, concurrency);

        for (const record of records) {
          yield record.getForm();

          _this.queue.push({ record });
        }

        yield _this.queue.drain();
      } else {
        console.error('Unable to find account', fulcrum.args.org);
      }
    });

    this.workerFunction = (() => {
      var _ref2 = _asyncToGenerator(function* (task) {
        try {
          yield _this.runReport({ record: task.record });
        } catch (err) {
          console.error('Error', err);
        }
      });

      return function (_x) {
        return _ref2.apply(this, arguments);
      };
    })();

    this.onRecordSave = (() => {
      var _ref3 = _asyncToGenerator(function* ({ record }) {
        _this.runReport({ record });
      });

      return function (_x2) {
        return _ref3.apply(this, arguments);
      };
    })();

    this.runReport = (() => {
      var _ref4 = _asyncToGenerator(function* ({ record, template, header, footer, cover }) {
        const fileName = _this.fileName === 'title' ? record.displayValue || record.id : record.id;

        const params = {
          reportName: fileName,
          directory: _this.reportPath,
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
          ejsOptions: {}
        };

        yield _this.generatePDF(params);

        if (fulcrum.args.repeatables) {
          for (const item of record.formValues.repeatableItems) {
            const repeatableFileName = _this.fileName === 'title' ? `${fileName} - ${item.displayValue}` : item.id;

            params.reportName = repeatableFileName;
            params.data.record = item;

            yield _this.generatePDF(params);
          }
        }
      });

      return function (_x3) {
        return _ref4.apply(this, arguments);
      };
    })();

    this.getPhotoURL = item => {
      if (fulcrum.args.mediaPath) {
        return _path2.default.join(fulcrum.args.mediaPath, 'photos', item.mediaID + '.jpg');
      }

      const url = _fulcrumDesktopPlugin.APIClient.getPhotoURL(this.account, { id: item.mediaID });

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

          if (element.isRepeatableElement && fulcrum.args.recurse === false) {
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
            type: 'string'
          },
          where: {
            desc: 'sql where clause',
            type: 'string'
          },
          template: {
            desc: 'path to ejs template file',
            type: 'string'
          },
          header: {
            desc: 'path to header ejs template file',
            type: 'string'
          },
          footer: {
            desc: 'path to footer ejs template file',
            type: 'string'
          },
          reportPath: {
            desc: 'report storage directory',
            type: 'string'
          },
          mediaPath: {
            desc: 'media storage directory',
            type: 'string'
          },
          fileName: {
            desc: 'file name',
            type: 'string'
          },
          concurrency: {
            desc: 'concurrent reports (between 1 and 10)',
            type: 'number',
            default: 5
          },
          repeatables: {
            desc: 'generate a PDF for each repeatable child record',
            type: 'boolean',
            default: false
          },
          recurse: {
            desc: 'recursively print all child items in each PDF',
            type: 'boolean',
            default: true
          }
        },
        handler: _this2.runCommand
      });
    })();
  }

  activate() {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      const templateFile = fulcrum.args.template || _path2.default.join(__dirname, 'template.ejs');

      _this3.template = _fs2.default.readFileSync(templateFile).toString();

      if (fulcrum.args.header) {
        _this3.header = _fs2.default.readFileSync(fulcrum.args.header).toString();
      }

      if (fulcrum.args.footer) {
        _this3.footer = _fs2.default.readFileSync(fulcrum.args.footer).toString();
      }

      _this3.reportPath = fulcrum.args.reportPath || fulcrum.dir('reports');
      _this3.fileName = fulcrum.args.fileName === 'title' ? 'title' : 'id';

      _mkdirp2.default.sync(_this3.reportPath);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJydW5Db21tYW5kIiwiYWN0aXZhdGUiLCJhY2NvdW50IiwiZnVsY3J1bSIsImZldGNoQWNjb3VudCIsImFyZ3MiLCJvcmciLCJmb3JtIiwiZmluZEZpcnN0Rm9ybSIsIm5hbWUiLCJyZWNvcmRzIiwiZmluZFJlY29yZHNCeVNRTCIsIndoZXJlIiwiY29uY3VycmVuY3kiLCJNYXRoIiwibWluIiwibWF4IiwicXVldWUiLCJ3b3JrZXJGdW5jdGlvbiIsInJlY29yZCIsImdldEZvcm0iLCJwdXNoIiwiZHJhaW4iLCJjb25zb2xlIiwiZXJyb3IiLCJ0YXNrIiwicnVuUmVwb3J0IiwiZXJyIiwib25SZWNvcmRTYXZlIiwidGVtcGxhdGUiLCJoZWFkZXIiLCJmb290ZXIiLCJjb3ZlciIsImZpbGVOYW1lIiwiZGlzcGxheVZhbHVlIiwiaWQiLCJwYXJhbXMiLCJyZXBvcnROYW1lIiwiZGlyZWN0b3J5IiwicmVwb3J0UGF0aCIsImRhdGEiLCJEYXRlVXRpbHMiLCJyZW5kZXJWYWx1ZXMiLCJnZXRQaG90b1VSTCIsImVqc09wdGlvbnMiLCJnZW5lcmF0ZVBERiIsInJlcGVhdGFibGVzIiwiaXRlbSIsImZvcm1WYWx1ZXMiLCJyZXBlYXRhYmxlSXRlbXMiLCJyZXBlYXRhYmxlRmlsZU5hbWUiLCJtZWRpYVBhdGgiLCJqb2luIiwibWVkaWFJRCIsInVybCIsImluZGV4T2YiLCJyZXBsYWNlIiwiZmVhdHVyZSIsInJlbmRlckZ1bmN0aW9uIiwicmVuZGVyVmFsdWVzUmVjdXJzaXZlIiwiY29udGFpbmVyIiwiZWxlbWVudHMiLCJlbGVtZW50IiwiZm9ybVZhbHVlIiwiZ2V0Iiwia2V5IiwiaXNTZWN0aW9uRWxlbWVudCIsImlzUmVwZWF0YWJsZUVsZW1lbnQiLCJzaG91bGRSZWN1cnNlIiwicmVjdXJzZSIsIml0ZW1zIiwiY2xpIiwiY29tbWFuZCIsImRlc2MiLCJidWlsZGVyIiwicmVxdWlyZWQiLCJ0eXBlIiwiZGVmYXVsdCIsImhhbmRsZXIiLCJ0ZW1wbGF0ZUZpbGUiLCJfX2Rpcm5hbWUiLCJyZWFkRmlsZVN5bmMiLCJ0b1N0cmluZyIsImRpciIsInN5bmMiLCJsb2ciLCJpc1JlY29yZCIsImdyZWVuIiwiZ2VuZXJhdGUiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOztBQUNBOzs7Ozs7OztrQkFFZSxNQUFNO0FBQUE7QUFBQTs7QUFBQSxTQStEbkJBLFVBL0RtQixxQkErRE4sYUFBWTtBQUN2QixZQUFNLE1BQUtDLFFBQUwsRUFBTjs7QUFFQSxZQUFNQyxVQUFVLE1BQU1DLFFBQVFDLFlBQVIsQ0FBcUJELFFBQVFFLElBQVIsQ0FBYUMsR0FBbEMsQ0FBdEI7O0FBRUEsVUFBSUosT0FBSixFQUFhO0FBQ1gsY0FBS0EsT0FBTCxHQUFlQSxPQUFmOztBQUVBLGNBQU1LLE9BQU8sTUFBTUwsUUFBUU0sYUFBUixDQUFzQixFQUFDQyxNQUFNTixRQUFRRSxJQUFSLENBQWFFLElBQXBCLEVBQXRCLENBQW5COztBQUVBLGNBQU1HLFVBQVUsTUFBTUgsS0FBS0ksZ0JBQUwsQ0FBc0JSLFFBQVFFLElBQVIsQ0FBYU8sS0FBbkMsQ0FBdEI7O0FBRUEsY0FBTUMsY0FBY0MsS0FBS0MsR0FBTCxDQUFTRCxLQUFLRSxHQUFMLENBQVMsQ0FBVCxFQUFZYixRQUFRRSxJQUFSLENBQWFRLFdBQWIsSUFBNEIsQ0FBeEMsQ0FBVCxFQUFxRCxFQUFyRCxDQUFwQjs7QUFFQSxjQUFLSSxLQUFMLEdBQWEsOEJBQW9CLE1BQUtDLGNBQXpCLEVBQXlDTCxXQUF6QyxDQUFiOztBQUVBLGFBQUssTUFBTU0sTUFBWCxJQUFxQlQsT0FBckIsRUFBOEI7QUFDNUIsZ0JBQU1TLE9BQU9DLE9BQVAsRUFBTjs7QUFFQSxnQkFBS0gsS0FBTCxDQUFXSSxJQUFYLENBQWdCLEVBQUNGLE1BQUQsRUFBaEI7QUFDRDs7QUFFRCxjQUFNLE1BQUtGLEtBQUwsQ0FBV0ssS0FBWCxFQUFOO0FBRUQsT0FuQkQsTUFtQk87QUFDTEMsZ0JB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YUFBR29ELFlBQUgsQ0FBZ0JGLFlBQWhCLEVBQThCRyxRQUE5QixFQUFoQjs7QUFFQSxVQUFJL0UsUUFBUUUsSUFBUixDQUFheUIsTUFBakIsRUFBeUI7QUFDdkIsZUFBS0EsTUFBTCxHQUFjLGFBQUdtRCxZQUFILENBQWdCOUUsUUFBUUUsSUFBUixDQUFheUIsTUFBN0IsRUFBcUNvRCxRQUFyQyxFQUFkO0FBQ0Q7O0FBRUQsVUFBSS9FLFFBQVFFLElBQVIsQ0FBYTBCLE1BQWpCLEVBQXlCO0FBQ3ZCLGVBQUtBLE1BQUwsR0FBYyxhQUFHa0QsWUFBSCxDQUFnQjlFLFFBQVFFLElBQVIsQ0FBYTBCLE1BQTdCLEVBQXFDbUQsUUFBckMsRUFBZDtBQUNEOztBQUVELGFBQUszQyxVQUFMLEdBQWtCcEMsUUFBUUUsSUFBUixDQUFha0MsVUFBYixJQUEyQnBDLFFBQVFnRixHQUFSLENBQVksU0FBWixDQUE3QztBQUNBLGFBQUtsRCxRQUFMLEdBQWdCOUIsUUFBUUUsSUFBUixDQUFhNEIsUUFBYixLQUEwQixPQUExQixHQUFvQyxPQUFwQyxHQUE4QyxJQUE5RDs7QUFFQSx1QkFBT21ELElBQVAsQ0FBWSxPQUFLN0MsVUFBakI7QUFDQTtBQWpCZTtBQWtCaEI7O0FBK0NLTSxhQUFOLENBQWtCVCxNQUFsQixFQUEwQjtBQUFBO0FBQ3hCYixjQUFROEQsR0FBUixDQUFZLFlBQVosRUFBMEJqRCxPQUFPSSxJQUFQLENBQVlyQixNQUFaLENBQW1CbUUsUUFBbkIsR0FBOEIsU0FBU0MsS0FBdkMsR0FBK0MsZUFBZUEsS0FBeEYsRUFBK0ZuRCxPQUFPQyxVQUF0RztBQUNBLGFBQU8sTUFBTSxzQ0FBZ0JtRCxRQUFoQixDQUF5QnBELE1BQXpCLENBQWI7QUFGd0I7QUFHekI7O0FBaEtrQixDIiwiZmlsZSI6InBsdWdpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBta2RpcnAgZnJvbSAnbWtkaXJwJztcbmltcG9ydCB7IFJlcG9ydEdlbmVyYXRvciwgQVBJQ2xpZW50LCBjb3JlIH0gZnJvbSAnZnVsY3J1bSc7XG5pbXBvcnQgQ29uY3VycmVudFF1ZXVlIGZyb20gJy4vY29uY3VycmVudC1xdWV1ZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIHtcbiAgYXN5bmMgdGFzayhjbGkpIHtcbiAgICByZXR1cm4gY2xpLmNvbW1hbmQoe1xuICAgICAgY29tbWFuZDogJ3JlcG9ydHMnLFxuICAgICAgZGVzYzogJ3J1biB0aGUgcGRmIHJlcG9ydHMgc3luYyBmb3IgYSBzcGVjaWZpYyBvcmdhbml6YXRpb24nLFxuICAgICAgYnVpbGRlcjoge1xuICAgICAgICBvcmc6IHtcbiAgICAgICAgICBkZXNjOiAnb3JnYW5pemF0aW9uIG5hbWUnLFxuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIGZvcm06IHtcbiAgICAgICAgICBkZXNjOiAnZm9ybSBuYW1lJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIGRlc2M6ICdzcWwgd2hlcmUgY2xhdXNlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIGRlc2M6ICdwYXRoIHRvIGVqcyB0ZW1wbGF0ZSBmaWxlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBoZWFkZXI6IHtcbiAgICAgICAgICBkZXNjOiAncGF0aCB0byBoZWFkZXIgZWpzIHRlbXBsYXRlIGZpbGUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIGZvb3Rlcjoge1xuICAgICAgICAgIGRlc2M6ICdwYXRoIHRvIGZvb3RlciBlanMgdGVtcGxhdGUgZmlsZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgcmVwb3J0UGF0aDoge1xuICAgICAgICAgIGRlc2M6ICdyZXBvcnQgc3RvcmFnZSBkaXJlY3RvcnknLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1lZGlhUGF0aDoge1xuICAgICAgICAgIGRlc2M6ICdtZWRpYSBzdG9yYWdlIGRpcmVjdG9yeScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgZmlsZU5hbWU6IHtcbiAgICAgICAgICBkZXNjOiAnZmlsZSBuYW1lJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBjb25jdXJyZW5jeToge1xuICAgICAgICAgIGRlc2M6ICdjb25jdXJyZW50IHJlcG9ydHMgKGJldHdlZW4gMSBhbmQgMTApJyxcbiAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICBkZWZhdWx0OiA1XG4gICAgICAgIH0sXG4gICAgICAgIHJlcGVhdGFibGVzOiB7XG4gICAgICAgICAgZGVzYzogJ2dlbmVyYXRlIGEgUERGIGZvciBlYWNoIHJlcGVhdGFibGUgY2hpbGQgcmVjb3JkJyxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgfSxcbiAgICAgICAgcmVjdXJzZToge1xuICAgICAgICAgIGRlc2M6ICdyZWN1cnNpdmVseSBwcmludCBhbGwgY2hpbGQgaXRlbXMgaW4gZWFjaCBQREYnLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBoYW5kbGVyOiB0aGlzLnJ1bkNvbW1hbmRcbiAgICB9KTtcbiAgfVxuXG4gIHJ1bkNvbW1hbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgdGhpcy5hY3RpdmF0ZSgpO1xuXG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGZ1bGNydW0uZmV0Y2hBY2NvdW50KGZ1bGNydW0uYXJncy5vcmcpO1xuXG4gICAgaWYgKGFjY291bnQpIHtcbiAgICAgIHRoaXMuYWNjb3VudCA9IGFjY291bnQ7XG5cbiAgICAgIGNvbnN0IGZvcm0gPSBhd2FpdCBhY2NvdW50LmZpbmRGaXJzdEZvcm0oe25hbWU6IGZ1bGNydW0uYXJncy5mb3JtfSk7XG5cbiAgICAgIGNvbnN0IHJlY29yZHMgPSBhd2FpdCBmb3JtLmZpbmRSZWNvcmRzQnlTUUwoZnVsY3J1bS5hcmdzLndoZXJlKTtcblxuICAgICAgY29uc3QgY29uY3VycmVuY3kgPSBNYXRoLm1pbihNYXRoLm1heCgxLCBmdWxjcnVtLmFyZ3MuY29uY3VycmVuY3kgfHwgNSksIDEwKTtcblxuICAgICAgdGhpcy5xdWV1ZSA9IG5ldyBDb25jdXJyZW50UXVldWUodGhpcy53b3JrZXJGdW5jdGlvbiwgY29uY3VycmVuY3kpO1xuXG4gICAgICBmb3IgKGNvbnN0IHJlY29yZCBvZiByZWNvcmRzKSB7XG4gICAgICAgIGF3YWl0IHJlY29yZC5nZXRGb3JtKCk7XG5cbiAgICAgICAgdGhpcy5xdWV1ZS5wdXNoKHtyZWNvcmR9KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy5xdWV1ZS5kcmFpbigpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuYWJsZSB0byBmaW5kIGFjY291bnQnLCBmdWxjcnVtLmFyZ3Mub3JnKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBhY3RpdmF0ZSgpIHtcbiAgICBjb25zdCB0ZW1wbGF0ZUZpbGUgPSBmdWxjcnVtLmFyZ3MudGVtcGxhdGUgfHwgcGF0aC5qb2luKF9fZGlybmFtZSwgJ3RlbXBsYXRlLmVqcycpO1xuXG4gICAgdGhpcy50ZW1wbGF0ZSA9IGZzLnJlYWRGaWxlU3luYyh0ZW1wbGF0ZUZpbGUpLnRvU3RyaW5nKCk7XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLmhlYWRlcikge1xuICAgICAgdGhpcy5oZWFkZXIgPSBmcy5yZWFkRmlsZVN5bmMoZnVsY3J1bS5hcmdzLmhlYWRlcikudG9TdHJpbmcoKTtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLmZvb3Rlcikge1xuICAgICAgdGhpcy5mb290ZXIgPSBmcy5yZWFkRmlsZVN5bmMoZnVsY3J1bS5hcmdzLmZvb3RlcikudG9TdHJpbmcoKTtcbiAgICB9XG5cbiAgICB0aGlzLnJlcG9ydFBhdGggPSBmdWxjcnVtLmFyZ3MucmVwb3J0UGF0aCB8fCBmdWxjcnVtLmRpcigncmVwb3J0cycpO1xuICAgIHRoaXMuZmlsZU5hbWUgPSBmdWxjcnVtLmFyZ3MuZmlsZU5hbWUgPT09ICd0aXRsZScgPyAndGl0bGUnIDogJ2lkJztcblxuICAgIG1rZGlycC5zeW5jKHRoaXMucmVwb3J0UGF0aCk7XG4gICAgLy8gZnVsY3J1bS5vbigncmVjb3JkOnNhdmUnLCB0aGlzLm9uUmVjb3JkU2F2ZSk7XG4gIH1cblxuICB3b3JrZXJGdW5jdGlvbiA9IGFzeW5jICh0YXNrKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucnVuUmVwb3J0KHtyZWNvcmQ6IHRhc2sucmVjb3JkfSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvcicsIGVycik7XG4gICAgfVxuICB9XG5cbiAgb25SZWNvcmRTYXZlID0gYXN5bmMgKHtyZWNvcmR9KSA9PiB7XG4gICAgdGhpcy5ydW5SZXBvcnQoe3JlY29yZH0pO1xuICB9XG5cbiAgcnVuUmVwb3J0ID0gYXN5bmMgKHtyZWNvcmQsIHRlbXBsYXRlLCBoZWFkZXIsIGZvb3RlciwgY292ZXJ9KSA9PiB7XG4gICAgY29uc3QgZmlsZU5hbWUgPSB0aGlzLmZpbGVOYW1lID09PSAndGl0bGUnID8gcmVjb3JkLmRpc3BsYXlWYWx1ZSB8fCByZWNvcmQuaWQgOiByZWNvcmQuaWQ7XG5cbiAgICBjb25zdCBwYXJhbXMgPSB7XG4gICAgICByZXBvcnROYW1lOiBmaWxlTmFtZSxcbiAgICAgIGRpcmVjdG9yeTogdGhpcy5yZXBvcnRQYXRoLFxuICAgICAgdGVtcGxhdGU6IHRlbXBsYXRlIHx8IHRoaXMudGVtcGxhdGUsXG4gICAgICBoZWFkZXI6IGhlYWRlciB8fCB0aGlzLmhlYWRlcixcbiAgICAgIGZvb3RlcjogZm9vdGVyIHx8IHRoaXMuZm9vdGVyLFxuICAgICAgY292ZXIsXG4gICAgICBkYXRhOiB7XG4gICAgICAgIERhdGVVdGlsczogY29yZS5EYXRlVXRpbHMsXG4gICAgICAgIHJlY29yZDogcmVjb3JkLFxuICAgICAgICByZW5kZXJWYWx1ZXM6IHRoaXMucmVuZGVyVmFsdWVzLFxuICAgICAgICBnZXRQaG90b1VSTDogdGhpcy5nZXRQaG90b1VSTFxuICAgICAgfSxcbiAgICAgIGVqc09wdGlvbnM6IHt9XG4gICAgfTtcblxuICAgIGF3YWl0IHRoaXMuZ2VuZXJhdGVQREYocGFyYW1zKTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MucmVwZWF0YWJsZXMpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiByZWNvcmQuZm9ybVZhbHVlcy5yZXBlYXRhYmxlSXRlbXMpIHtcbiAgICAgICAgY29uc3QgcmVwZWF0YWJsZUZpbGVOYW1lID0gdGhpcy5maWxlTmFtZSA9PT0gJ3RpdGxlJyA/IGAke2ZpbGVOYW1lfSAtICR7aXRlbS5kaXNwbGF5VmFsdWV9YCA6IGl0ZW0uaWQ7XG5cbiAgICAgICAgcGFyYW1zLnJlcG9ydE5hbWUgPSByZXBlYXRhYmxlRmlsZU5hbWU7XG4gICAgICAgIHBhcmFtcy5kYXRhLnJlY29yZCA9IGl0ZW07XG5cbiAgICAgICAgYXdhaXQgdGhpcy5nZW5lcmF0ZVBERihwYXJhbXMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdlbmVyYXRlUERGKHBhcmFtcykge1xuICAgIGNvbnNvbGUubG9nKCdHZW5lcmF0aW5nJywgcGFyYW1zLmRhdGEucmVjb3JkLmlzUmVjb3JkID8gJ3JlY29yZCcuZ3JlZW4gOiAnY2hpbGQgcmVjb3JkJy5ncmVlbiwgcGFyYW1zLnJlcG9ydE5hbWUpO1xuICAgIHJldHVybiBhd2FpdCBSZXBvcnRHZW5lcmF0b3IuZ2VuZXJhdGUocGFyYW1zKTtcbiAgfVxuXG4gIGdldFBob3RvVVJMID0gKGl0ZW0pID0+IHtcbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1lZGlhUGF0aCkge1xuICAgICAgcmV0dXJuIHBhdGguam9pbihmdWxjcnVtLmFyZ3MubWVkaWFQYXRoLCAncGhvdG9zJywgaXRlbS5tZWRpYUlEICsgJy5qcGcnKTtcbiAgICB9XG5cbiAgICBjb25zdCB1cmwgPSBBUElDbGllbnQuZ2V0UGhvdG9VUkwodGhpcy5hY2NvdW50LCB7aWQ6IGl0ZW0ubWVkaWFJRH0pO1xuXG4gICAgaWYgKHVybC5pbmRleE9mKCcuanBnJykgPT09IC0xKSB7XG4gICAgICByZXR1cm4gdXJsLnJlcGxhY2UoJz8nLCAnLmpwZz8nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdXJsO1xuICB9XG5cbiAgcmVuZGVyVmFsdWVzID0gKGZlYXR1cmUsIHJlbmRlckZ1bmN0aW9uKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMucmVuZGVyVmFsdWVzUmVjdXJzaXZlKGZlYXR1cmUsIGZlYXR1cmUuZm9ybVZhbHVlcy5jb250YWluZXIuZWxlbWVudHMsIHJlbmRlckZ1bmN0aW9uKTtcbiAgfVxuXG4gIHJlbmRlclZhbHVlc1JlY3Vyc2l2ZSA9IChmZWF0dXJlLCBlbGVtZW50cywgcmVuZGVyRnVuY3Rpb24pID0+IHtcbiAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMpIHtcbiAgICAgIGNvbnN0IGZvcm1WYWx1ZSA9IGZlYXR1cmUuZm9ybVZhbHVlcy5nZXQoZWxlbWVudC5rZXkpO1xuXG4gICAgICByZW5kZXJGdW5jdGlvbihlbGVtZW50LCBmb3JtVmFsdWUpO1xuXG4gICAgICBpZiAoZWxlbWVudC5pc1NlY3Rpb25FbGVtZW50KSB7XG4gICAgICAgIHRoaXMucmVuZGVyVmFsdWVzUmVjdXJzaXZlKGZlYXR1cmUsIGVsZW1lbnQuZWxlbWVudHMsIHJlbmRlckZ1bmN0aW9uKTtcbiAgICAgIH0gZWxzZSBpZiAoZWxlbWVudC5pc1JlcGVhdGFibGVFbGVtZW50KSB7XG4gICAgICAgIGxldCBzaG91bGRSZWN1cnNlID0gdHJ1ZTtcblxuICAgICAgICBpZiAoZWxlbWVudC5pc1JlcGVhdGFibGVFbGVtZW50ICYmIGZ1bGNydW0uYXJncy5yZWN1cnNlID09PSBmYWxzZSkge1xuICAgICAgICAgIHNob3VsZFJlY3Vyc2UgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmb3JtVmFsdWUgJiYgc2hvdWxkUmVjdXJzZSkge1xuICAgICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBmb3JtVmFsdWUuaXRlbXMpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyVmFsdWVzUmVjdXJzaXZlKGl0ZW0sIGVsZW1lbnQuZWxlbWVudHMsIHJlbmRlckZ1bmN0aW9uKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==