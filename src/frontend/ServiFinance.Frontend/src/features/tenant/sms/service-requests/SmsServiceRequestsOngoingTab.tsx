import { ServiceRequestTabPanel, type ServiceRequestTabProps } from "./ServiceRequestTabPanel";

export function SmsServiceRequestsOngoingTab(props: ServiceRequestTabProps) {
  return <ServiceRequestTabPanel {...props} emptyLabel="ongoing" />;
}
