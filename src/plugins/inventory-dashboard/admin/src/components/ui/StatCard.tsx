import { Card, CardBody } from '@chakra-ui/react';
import { StatTile } from './StatTile';
import { type IconComponent } from '../../config/navConfig';

export function StatCard({ label, value, icon }: { label: string; value: string; icon: IconComponent }) {
  return (
    <Card>
      <CardBody>
        <StatTile label={label} value={value} icon={icon} size="stat" />
      </CardBody>
    </Card>
  );
}
