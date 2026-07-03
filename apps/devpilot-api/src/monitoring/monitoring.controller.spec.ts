import { RequestMethod } from "@nestjs/common";
import {
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";
import { MonitoringAccessService } from "./monitoring-access.service";
import { MonitoringDashboardController } from "./monitoring-dashboard.controller";
import { MonitoringNotificationController } from "./monitoring-notification.controller";
import { MonitoringSilenceController } from "./monitoring-silence.controller";
import { MonitoringController } from "./monitoring.controller";
import { MonitoringModule } from "./monitoring.module";

type ControllerRoute = {
  controller: new (...args: never[]) => unknown;
  methodName: string;
  path: string;
  requestMethod: RequestMethod;
};

const controllerRoutes: ControllerRoute[] = [
  {
    controller: MonitoringController,
    methodName: "listRules",
    path: "alert-rules",
    requestMethod: RequestMethod.GET,
  },
  {
    controller: MonitoringController,
    methodName: "createRule",
    path: "alert-rules",
    requestMethod: RequestMethod.POST,
  },
  {
    controller: MonitoringController,
    methodName: "updateRule",
    path: "alert-rules/:ruleId",
    requestMethod: RequestMethod.PUT,
  },
  {
    controller: MonitoringController,
    methodName: "evaluateRule",
    path: "alert-rules/:ruleId/evaluate",
    requestMethod: RequestMethod.POST,
  },
  {
    controller: MonitoringController,
    methodName: "listEvents",
    path: "alert-events",
    requestMethod: RequestMethod.GET,
  },
  {
    controller: MonitoringController,
    methodName: "acknowledgeEvent",
    path: "alert-events/:eventId/acknowledge",
    requestMethod: RequestMethod.POST,
  },
  {
    controller: MonitoringDashboardController,
    methodName: "getResourceMetricDashboard",
    path: "resource-metrics/dashboard",
    requestMethod: RequestMethod.GET,
  },
  {
    controller: MonitoringDashboardController,
    methodName: "listServiceSloRuleTemplates",
    path: "service-slo/templates",
    requestMethod: RequestMethod.GET,
  },
  {
    controller: MonitoringDashboardController,
    methodName: "getServiceSloDashboard",
    path: "service-slo/dashboard",
    requestMethod: RequestMethod.GET,
  },
  {
    controller: MonitoringSilenceController,
    methodName: "listSilences",
    path: "silences",
    requestMethod: RequestMethod.GET,
  },
  {
    controller: MonitoringSilenceController,
    methodName: "createSilence",
    path: "silences",
    requestMethod: RequestMethod.POST,
  },
  {
    controller: MonitoringSilenceController,
    methodName: "updateSilence",
    path: "silences/:silenceId",
    requestMethod: RequestMethod.PUT,
  },
  {
    controller: MonitoringNotificationController,
    methodName: "listNotificationChannels",
    path: "notification-channels",
    requestMethod: RequestMethod.GET,
  },
  {
    controller: MonitoringNotificationController,
    methodName: "createNotificationChannel",
    path: "notification-channels",
    requestMethod: RequestMethod.POST,
  },
  {
    controller: MonitoringNotificationController,
    methodName: "updateNotificationChannel",
    path: "notification-channels/:channelId",
    requestMethod: RequestMethod.PUT,
  },
  {
    controller: MonitoringNotificationController,
    methodName: "listNotificationDeliveries",
    path: "notification-deliveries",
    requestMethod: RequestMethod.GET,
  },
  {
    controller: MonitoringNotificationController,
    methodName: "retryNotificationDelivery",
    path: "notification-deliveries/:deliveryId/retry",
    requestMethod: RequestMethod.POST,
  },
];

describe("Monitoring controller route split", () => {
  it("keeps every monitoring controller on the shared monitoring base path", () => {
    const controllers = new Set(
      controllerRoutes.map((route) => route.controller),
    );

    for (const controller of controllers) {
      expect(Reflect.getMetadata(PATH_METADATA, controller)).toBe("monitoring");
    }
  });

  it("keeps monitoring module controller and access provider wiring", () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, MonitoringModule),
    ).toEqual(
      expect.arrayContaining([
        MonitoringController,
        MonitoringDashboardController,
        MonitoringSilenceController,
        MonitoringNotificationController,
      ]),
    );
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, MonitoringModule),
    ).toEqual(expect.arrayContaining([MonitoringAccessService]));
  });

  it("keeps monitoring route paths and request methods stable", () => {
    for (const route of controllerRoutes) {
      const handler = route.controller.prototype[route.methodName];

      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(route.path);
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
        route.requestMethod,
      );
    }
  });
});
