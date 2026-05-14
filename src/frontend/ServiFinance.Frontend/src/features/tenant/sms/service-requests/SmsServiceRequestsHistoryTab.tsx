import { ServiceRequestTabPanel, type ServiceRequestTabProps } from "./ServiceRequestTabPanel";

export function SmsServiceRequestsHistoryTab(props: ServiceRequestTabProps) {
  return <ServiceRequestTabPanel {...props} emptyLabel="history" />;
}
