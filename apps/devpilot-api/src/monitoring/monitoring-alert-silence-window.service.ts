import { BadRequestException, Injectable } from "@nestjs/common";

@Injectable()
export class MonitoringAlertSilenceWindowService {
  resolveWindow(
    startsAtValue?: string,
    endsAtValue?: string,
    currentStartsAt?: Date,
    currentEndsAt?: Date | null,
  ) {
    const startsAt =
      startsAtValue !== undefined
        ? this.parseDateInput(startsAtValue, "静默开始时间无效")
        : currentStartsAt || new Date();
    const endsAt =
      endsAtValue !== undefined
        ? this.parseDateInput(endsAtValue, "静默结束时间无效")
        : currentEndsAt ?? null;

    if (endsAt && endsAt <= startsAt) {
      throw new BadRequestException("静默结束时间必须晚于开始时间");
    }

    return { startsAt, endsAt };
  }

  private parseDateInput(value: string, message: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(message);
    }
    return date;
  }
}
