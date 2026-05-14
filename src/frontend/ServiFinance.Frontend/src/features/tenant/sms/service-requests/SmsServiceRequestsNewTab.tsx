import { ServiceRequestTabPanel, type ServiceRequestTabProps } from "./ServiceRequestTabPanel";

export function SmsServiceRequestsNewTab(props: ServiceRequestTabProps) {
  return <ServiceRequestTabPanel {...props} emptyLabel="new" />;
}
