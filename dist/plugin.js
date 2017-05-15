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
            desc: 'concurrent downloads (between 1 and 10)',
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJydW5Db21tYW5kIiwiYWN0aXZhdGUiLCJhY2NvdW50IiwiZnVsY3J1bSIsImZldGNoQWNjb3VudCIsImFyZ3MiLCJvcmciLCJmb3JtIiwiZmluZEZpcnN0Rm9ybSIsIm5hbWUiLCJyZWNvcmRzIiwiZmluZFJlY29yZHNCeVNRTCIsIndoZXJlIiwiY29uY3VycmVuY3kiLCJNYXRoIiwibWluIiwibWF4IiwicXVldWUiLCJ3b3JrZXJGdW5jdGlvbiIsInJlY29yZCIsImdldEZvcm0iLCJwdXNoIiwiZHJhaW4iLCJjb25zb2xlIiwiZXJyb3IiLCJ0YXNrIiwicnVuUmVwb3J0IiwiZXJyIiwib25SZWNvcmRTYXZlIiwidGVtcGxhdGUiLCJoZWFkZXIiLCJmb290ZXIiLCJjb3ZlciIsImZpbGVOYW1lIiwiZGlzcGxheVZhbHVlIiwiaWQiLCJwYXJhbXMiLCJyZXBvcnROYW1lIiwiZGlyZWN0b3J5IiwicmVwb3J0UGF0aCIsImRhdGEiLCJEYXRlVXRpbHMiLCJyZW5kZXJWYWx1ZXMiLCJnZXRQaG90b1VSTCIsImVqc09wdGlvbnMiLCJnZW5lcmF0ZVBERiIsInJlcGVhdGFibGVzIiwiaXRlbSIsImZvcm1WYWx1ZXMiLCJyZXBlYXRhYmxlSXRlbXMiLCJyZXBlYXRhYmxlRmlsZU5hbWUiLCJtZWRpYVBhdGgiLCJqb2luIiwibWVkaWFJRCIsInVybCIsImluZGV4T2YiLCJyZXBsYWNlIiwiZmVhdHVyZSIsInJlbmRlckZ1bmN0aW9uIiwicmVuZGVyVmFsdWVzUmVjdXJzaXZlIiwiY29udGFpbmVyIiwiZWxlbWVudHMiLCJlbGVtZW50IiwiZm9ybVZhbHVlIiwiZ2V0Iiwia2V5IiwiaXNTZWN0aW9uRWxlbWVudCIsImlzUmVwZWF0YWJsZUVsZW1lbnQiLCJzaG91bGRSZWN1cnNlIiwicmVjdXJzZSIsIml0ZW1zIiwiY2xpIiwiY29tbWFuZCIsImRlc2MiLCJidWlsZGVyIiwicmVxdWlyZWQiLCJ0eXBlIiwiZGVmYXVsdCIsImhhbmRsZXIiLCJ0ZW1wbGF0ZUZpbGUiLCJfX2Rpcm5hbWUiLCJyZWFkRmlsZVN5bmMiLCJ0b1N0cmluZyIsImRpciIsInN5bmMiLCJsb2ciLCJpc1JlY29yZCIsImdyZWVuIiwiZ2VuZXJhdGUiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOztBQUNBOzs7Ozs7OztrQkFFZSxNQUFNO0FBQUE7QUFBQTs7QUFBQSxTQStEbkJBLFVBL0RtQixxQkErRE4sYUFBWTtBQUN2QixZQUFNLE1BQUtDLFFBQUwsRUFBTjs7QUFFQSxZQUFNQyxVQUFVLE1BQU1DLFFBQVFDLFlBQVIsQ0FBcUJELFFBQVFFLElBQVIsQ0FBYUMsR0FBbEMsQ0FBdEI7O0FBRUEsVUFBSUosT0FBSixFQUFhO0FBQ1gsY0FBS0EsT0FBTCxHQUFlQSxPQUFmOztBQUVBLGNBQU1LLE9BQU8sTUFBTUwsUUFBUU0sYUFBUixDQUFzQixFQUFDQyxNQUFNTixRQUFRRSxJQUFSLENBQWFFLElBQXBCLEVBQXRCLENBQW5COztBQUVBLGNBQU1HLFVBQVUsTUFBTUgsS0FBS0ksZ0JBQUwsQ0FBc0JSLFFBQVFFLElBQVIsQ0FBYU8sS0FBbkMsQ0FBdEI7O0FBRUEsY0FBTUMsY0FBY0MsS0FBS0MsR0FBTCxDQUFTRCxLQUFLRSxHQUFMLENBQVMsQ0FBVCxFQUFZYixRQUFRRSxJQUFSLENBQWFRLFdBQWIsSUFBNEIsQ0FBeEMsQ0FBVCxFQUFxRCxFQUFyRCxDQUFwQjs7QUFFQSxjQUFLSSxLQUFMLEdBQWEsOEJBQW9CLE1BQUtDLGNBQXpCLEVBQXlDTCxXQUF6QyxDQUFiOztBQUVBLGFBQUssTUFBTU0sTUFBWCxJQUFxQlQsT0FBckIsRUFBOEI7QUFDNUIsZ0JBQU1TLE9BQU9DLE9BQVAsRUFBTjs7QUFFQSxnQkFBS0gsS0FBTCxDQUFXSSxJQUFYLENBQWdCLEVBQUNGLE1BQUQsRUFBaEI7QUFDRDs7QUFFRCxjQUFNLE1BQUtGLEtBQUwsQ0FBV0ssS0FBWCxFQUFOO0FBRUQsT0FuQkQsTUFtQk87QUFDTEMsZ0JB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YUFBR29ELFlBQUgsQ0FBZ0JGLFlBQWhCLEVBQThCRyxRQUE5QixFQUFoQjs7QUFFQSxVQUFJL0UsUUFBUUUsSUFBUixDQUFheUIsTUFBakIsRUFBeUI7QUFDdkIsZUFBS0EsTUFBTCxHQUFjLGFBQUdtRCxZQUFILENBQWdCOUUsUUFBUUUsSUFBUixDQUFheUIsTUFBN0IsRUFBcUNvRCxRQUFyQyxFQUFkO0FBQ0Q7O0FBRUQsVUFBSS9FLFFBQVFFLElBQVIsQ0FBYTBCLE1BQWpCLEVBQXlCO0FBQ3ZCLGVBQUtBLE1BQUwsR0FBYyxhQUFHa0QsWUFBSCxDQUFnQjlFLFFBQVFFLElBQVIsQ0FBYTBCLE1BQTdCLEVBQXFDbUQsUUFBckMsRUFBZDtBQUNEOztBQUVELGFBQUszQyxVQUFMLEdBQWtCcEMsUUFBUUUsSUFBUixDQUFha0MsVUFBYixJQUEyQnBDLFFBQVFnRixHQUFSLENBQVksU0FBWixDQUE3QztBQUNBLGFBQUtsRCxRQUFMLEdBQWdCOUIsUUFBUUUsSUFBUixDQUFhNEIsUUFBYixLQUEwQixPQUExQixHQUFvQyxPQUFwQyxHQUE4QyxJQUE5RDs7QUFFQSx1QkFBT21ELElBQVAsQ0FBWSxPQUFLN0MsVUFBakI7QUFDQTtBQWpCZTtBQWtCaEI7O0FBK0NLTSxhQUFOLENBQWtCVCxNQUFsQixFQUEwQjtBQUFBO0FBQ3hCYixjQUFROEQsR0FBUixDQUFZLFlBQVosRUFBMEJqRCxPQUFPSSxJQUFQLENBQVlyQixNQUFaLENBQW1CbUUsUUFBbkIsR0FBOEIsU0FBU0MsS0FBdkMsR0FBK0MsZUFBZUEsS0FBeEYsRUFBK0ZuRCxPQUFPQyxVQUF0RztBQUNBLGFBQU8sTUFBTSxzQ0FBZ0JtRCxRQUFoQixDQUF5QnBELE1BQXpCLENBQWI7QUFGd0I7QUFHekI7O0FBaEtrQixDIiwiZmlsZSI6InBsdWdpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBta2RpcnAgZnJvbSAnbWtkaXJwJztcbmltcG9ydCB7IFJlcG9ydEdlbmVyYXRvciwgQVBJQ2xpZW50LCBjb3JlIH0gZnJvbSAnZnVsY3J1bSc7XG5pbXBvcnQgQ29uY3VycmVudFF1ZXVlIGZyb20gJy4vY29uY3VycmVudC1xdWV1ZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIHtcbiAgYXN5bmMgdGFzayhjbGkpIHtcbiAgICByZXR1cm4gY2xpLmNvbW1hbmQoe1xuICAgICAgY29tbWFuZDogJ3JlcG9ydHMnLFxuICAgICAgZGVzYzogJ3J1biB0aGUgcGRmIHJlcG9ydHMgc3luYyBmb3IgYSBzcGVjaWZpYyBvcmdhbml6YXRpb24nLFxuICAgICAgYnVpbGRlcjoge1xuICAgICAgICBvcmc6IHtcbiAgICAgICAgICBkZXNjOiAnb3JnYW5pemF0aW9uIG5hbWUnLFxuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIGZvcm06IHtcbiAgICAgICAgICBkZXNjOiAnZm9ybSBuYW1lJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIGRlc2M6ICdzcWwgd2hlcmUgY2xhdXNlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIGRlc2M6ICdwYXRoIHRvIGVqcyB0ZW1wbGF0ZSBmaWxlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBoZWFkZXI6IHtcbiAgICAgICAgICBkZXNjOiAncGF0aCB0byBoZWFkZXIgZWpzIHRlbXBsYXRlIGZpbGUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIGZvb3Rlcjoge1xuICAgICAgICAgIGRlc2M6ICdwYXRoIHRvIGZvb3RlciBlanMgdGVtcGxhdGUgZmlsZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgcmVwb3J0UGF0aDoge1xuICAgICAgICAgIGRlc2M6ICdyZXBvcnQgc3RvcmFnZSBkaXJlY3RvcnknLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1lZGlhUGF0aDoge1xuICAgICAgICAgIGRlc2M6ICdtZWRpYSBzdG9yYWdlIGRpcmVjdG9yeScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgZmlsZU5hbWU6IHtcbiAgICAgICAgICBkZXNjOiAnZmlsZSBuYW1lJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBjb25jdXJyZW5jeToge1xuICAgICAgICAgIGRlc2M6ICdjb25jdXJyZW50IGRvd25sb2FkcyAoYmV0d2VlbiAxIGFuZCAxMCknLFxuICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgIGRlZmF1bHQ6IDVcbiAgICAgICAgfSxcbiAgICAgICAgcmVwZWF0YWJsZXM6IHtcbiAgICAgICAgICBkZXNjOiAnZ2VuZXJhdGUgYSBQREYgZm9yIGVhY2ggcmVwZWF0YWJsZSBjaGlsZCByZWNvcmQnLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICB9LFxuICAgICAgICByZWN1cnNlOiB7XG4gICAgICAgICAgZGVzYzogJ3JlY3Vyc2l2ZWx5IHByaW50IGFsbCBjaGlsZCBpdGVtcyBpbiBlYWNoIFBERicsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IHRydWVcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGhhbmRsZXI6IHRoaXMucnVuQ29tbWFuZFxuICAgIH0pO1xuICB9XG5cbiAgcnVuQ29tbWFuZCA9IGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCB0aGlzLmFjdGl2YXRlKCk7XG5cbiAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZnVsY3J1bS5mZXRjaEFjY291bnQoZnVsY3J1bS5hcmdzLm9yZyk7XG5cbiAgICBpZiAoYWNjb3VudCkge1xuICAgICAgdGhpcy5hY2NvdW50ID0gYWNjb3VudDtcblxuICAgICAgY29uc3QgZm9ybSA9IGF3YWl0IGFjY291bnQuZmluZEZpcnN0Rm9ybSh7bmFtZTogZnVsY3J1bS5hcmdzLmZvcm19KTtcblxuICAgICAgY29uc3QgcmVjb3JkcyA9IGF3YWl0IGZvcm0uZmluZFJlY29yZHNCeVNRTChmdWxjcnVtLmFyZ3Mud2hlcmUpO1xuXG4gICAgICBjb25zdCBjb25jdXJyZW5jeSA9IE1hdGgubWluKE1hdGgubWF4KDEsIGZ1bGNydW0uYXJncy5jb25jdXJyZW5jeSB8fCA1KSwgMTApO1xuXG4gICAgICB0aGlzLnF1ZXVlID0gbmV3IENvbmN1cnJlbnRRdWV1ZSh0aGlzLndvcmtlckZ1bmN0aW9uLCBjb25jdXJyZW5jeSk7XG5cbiAgICAgIGZvciAoY29uc3QgcmVjb3JkIG9mIHJlY29yZHMpIHtcbiAgICAgICAgYXdhaXQgcmVjb3JkLmdldEZvcm0oKTtcblxuICAgICAgICB0aGlzLnF1ZXVlLnB1c2goe3JlY29yZH0pO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnF1ZXVlLmRyYWluKCk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcignVW5hYmxlIHRvIGZpbmQgYWNjb3VudCcsIGZ1bGNydW0uYXJncy5vcmcpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGFjdGl2YXRlKCkge1xuICAgIGNvbnN0IHRlbXBsYXRlRmlsZSA9IGZ1bGNydW0uYXJncy50ZW1wbGF0ZSB8fCBwYXRoLmpvaW4oX19kaXJuYW1lLCAndGVtcGxhdGUuZWpzJyk7XG5cbiAgICB0aGlzLnRlbXBsYXRlID0gZnMucmVhZEZpbGVTeW5jKHRlbXBsYXRlRmlsZSkudG9TdHJpbmcoKTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MuaGVhZGVyKSB7XG4gICAgICB0aGlzLmhlYWRlciA9IGZzLnJlYWRGaWxlU3luYyhmdWxjcnVtLmFyZ3MuaGVhZGVyKS50b1N0cmluZygpO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MuZm9vdGVyKSB7XG4gICAgICB0aGlzLmZvb3RlciA9IGZzLnJlYWRGaWxlU3luYyhmdWxjcnVtLmFyZ3MuZm9vdGVyKS50b1N0cmluZygpO1xuICAgIH1cblxuICAgIHRoaXMucmVwb3J0UGF0aCA9IGZ1bGNydW0uYXJncy5yZXBvcnRQYXRoIHx8IGZ1bGNydW0uZGlyKCdyZXBvcnRzJyk7XG4gICAgdGhpcy5maWxlTmFtZSA9IGZ1bGNydW0uYXJncy5maWxlTmFtZSA9PT0gJ3RpdGxlJyA/ICd0aXRsZScgOiAnaWQnO1xuXG4gICAgbWtkaXJwLnN5bmModGhpcy5yZXBvcnRQYXRoKTtcbiAgICAvLyBmdWxjcnVtLm9uKCdyZWNvcmQ6c2F2ZScsIHRoaXMub25SZWNvcmRTYXZlKTtcbiAgfVxuXG4gIHdvcmtlckZ1bmN0aW9uID0gYXN5bmMgKHRhc2spID0+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5ydW5SZXBvcnQoe3JlY29yZDogdGFzay5yZWNvcmR9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yJywgZXJyKTtcbiAgICB9XG4gIH1cblxuICBvblJlY29yZFNhdmUgPSBhc3luYyAoe3JlY29yZH0pID0+IHtcbiAgICB0aGlzLnJ1blJlcG9ydCh7cmVjb3JkfSk7XG4gIH1cblxuICBydW5SZXBvcnQgPSBhc3luYyAoe3JlY29yZCwgdGVtcGxhdGUsIGhlYWRlciwgZm9vdGVyLCBjb3Zlcn0pID0+IHtcbiAgICBjb25zdCBmaWxlTmFtZSA9IHRoaXMuZmlsZU5hbWUgPT09ICd0aXRsZScgPyByZWNvcmQuZGlzcGxheVZhbHVlIHx8IHJlY29yZC5pZCA6IHJlY29yZC5pZDtcblxuICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgIHJlcG9ydE5hbWU6IGZpbGVOYW1lLFxuICAgICAgZGlyZWN0b3J5OiB0aGlzLnJlcG9ydFBhdGgsXG4gICAgICB0ZW1wbGF0ZTogdGVtcGxhdGUgfHwgdGhpcy50ZW1wbGF0ZSxcbiAgICAgIGhlYWRlcjogaGVhZGVyIHx8IHRoaXMuaGVhZGVyLFxuICAgICAgZm9vdGVyOiBmb290ZXIgfHwgdGhpcy5mb290ZXIsXG4gICAgICBjb3ZlcixcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgRGF0ZVV0aWxzOiBjb3JlLkRhdGVVdGlscyxcbiAgICAgICAgcmVjb3JkOiByZWNvcmQsXG4gICAgICAgIHJlbmRlclZhbHVlczogdGhpcy5yZW5kZXJWYWx1ZXMsXG4gICAgICAgIGdldFBob3RvVVJMOiB0aGlzLmdldFBob3RvVVJMXG4gICAgICB9LFxuICAgICAgZWpzT3B0aW9uczoge31cbiAgICB9O1xuXG4gICAgYXdhaXQgdGhpcy5nZW5lcmF0ZVBERihwYXJhbXMpO1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5yZXBlYXRhYmxlcykge1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHJlY29yZC5mb3JtVmFsdWVzLnJlcGVhdGFibGVJdGVtcykge1xuICAgICAgICBjb25zdCByZXBlYXRhYmxlRmlsZU5hbWUgPSB0aGlzLmZpbGVOYW1lID09PSAndGl0bGUnID8gYCR7ZmlsZU5hbWV9IC0gJHtpdGVtLmRpc3BsYXlWYWx1ZX1gIDogaXRlbS5pZDtcblxuICAgICAgICBwYXJhbXMucmVwb3J0TmFtZSA9IHJlcGVhdGFibGVGaWxlTmFtZTtcbiAgICAgICAgcGFyYW1zLmRhdGEucmVjb3JkID0gaXRlbTtcblxuICAgICAgICBhd2FpdCB0aGlzLmdlbmVyYXRlUERGKHBhcmFtcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZ2VuZXJhdGVQREYocGFyYW1zKSB7XG4gICAgY29uc29sZS5sb2coJ0dlbmVyYXRpbmcnLCBwYXJhbXMuZGF0YS5yZWNvcmQuaXNSZWNvcmQgPyAncmVjb3JkJy5ncmVlbiA6ICdjaGlsZCByZWNvcmQnLmdyZWVuLCBwYXJhbXMucmVwb3J0TmFtZSk7XG4gICAgcmV0dXJuIGF3YWl0IFJlcG9ydEdlbmVyYXRvci5nZW5lcmF0ZShwYXJhbXMpO1xuICB9XG5cbiAgZ2V0UGhvdG9VUkwgPSAoaXRlbSkgPT4ge1xuICAgIGlmIChmdWxjcnVtLmFyZ3MubWVkaWFQYXRoKSB7XG4gICAgICByZXR1cm4gcGF0aC5qb2luKGZ1bGNydW0uYXJncy5tZWRpYVBhdGgsICdwaG90b3MnLCBpdGVtLm1lZGlhSUQgKyAnLmpwZycpO1xuICAgIH1cblxuICAgIGNvbnN0IHVybCA9IEFQSUNsaWVudC5nZXRQaG90b1VSTCh0aGlzLmFjY291bnQsIHtpZDogaXRlbS5tZWRpYUlEfSk7XG5cbiAgICBpZiAodXJsLmluZGV4T2YoJy5qcGcnKSA9PT0gLTEpIHtcbiAgICAgIHJldHVybiB1cmwucmVwbGFjZSgnPycsICcuanBnPycpO1xuICAgIH1cblxuICAgIHJldHVybiB1cmw7XG4gIH1cblxuICByZW5kZXJWYWx1ZXMgPSAoZmVhdHVyZSwgcmVuZGVyRnVuY3Rpb24pID0+IHtcbiAgICByZXR1cm4gdGhpcy5yZW5kZXJWYWx1ZXNSZWN1cnNpdmUoZmVhdHVyZSwgZmVhdHVyZS5mb3JtVmFsdWVzLmNvbnRhaW5lci5lbGVtZW50cywgcmVuZGVyRnVuY3Rpb24pO1xuICB9XG5cbiAgcmVuZGVyVmFsdWVzUmVjdXJzaXZlID0gKGZlYXR1cmUsIGVsZW1lbnRzLCByZW5kZXJGdW5jdGlvbikgPT4ge1xuICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cykge1xuICAgICAgY29uc3QgZm9ybVZhbHVlID0gZmVhdHVyZS5mb3JtVmFsdWVzLmdldChlbGVtZW50LmtleSk7XG5cbiAgICAgIHJlbmRlckZ1bmN0aW9uKGVsZW1lbnQsIGZvcm1WYWx1ZSk7XG5cbiAgICAgIGlmIChlbGVtZW50LmlzU2VjdGlvbkVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5yZW5kZXJWYWx1ZXNSZWN1cnNpdmUoZmVhdHVyZSwgZWxlbWVudC5lbGVtZW50cywgcmVuZGVyRnVuY3Rpb24pO1xuICAgICAgfSBlbHNlIGlmIChlbGVtZW50LmlzUmVwZWF0YWJsZUVsZW1lbnQpIHtcbiAgICAgICAgbGV0IHNob3VsZFJlY3Vyc2UgPSB0cnVlO1xuXG4gICAgICAgIGlmIChlbGVtZW50LmlzUmVwZWF0YWJsZUVsZW1lbnQgJiYgZnVsY3J1bS5hcmdzLnJlY3Vyc2UgPT09IGZhbHNlKSB7XG4gICAgICAgICAgc2hvdWxkUmVjdXJzZSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZvcm1WYWx1ZSAmJiBzaG91bGRSZWN1cnNlKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGZvcm1WYWx1ZS5pdGVtcykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJWYWx1ZXNSZWN1cnNpdmUoaXRlbSwgZWxlbWVudC5lbGVtZW50cywgcmVuZGVyRnVuY3Rpb24pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19