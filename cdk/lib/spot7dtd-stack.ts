import * as cdk from "aws-cdk-lib";
import { Tags, StackProps } from "aws-cdk-lib";
import { Asset } from "aws-cdk-lib/aws-s3-assets";
import { CfnOutput, aws_ec2 as ec2 } from "aws-cdk-lib";
import { Construct } from "constructs";
import { spot7dtdBase } from "./base-stack";
// import { readFileSync } from "fs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface spot7dtdrops extends StackProps {
  serverName: string;
  volumeSize: number;
  snapshotGen: number;
  base: spot7dtdBase;
}

const getString = (s: string | undefined, def: string): string => {
  return s === undefined ? def : s;
};

export class spot7dtdStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: spot7dtdrops) {
    super(scope, id, props);

    const asset = new Asset(this, "Asset", { path: "./scripts" });
    ////
    const setupCommands = ec2.UserData.forLinux();
    setupCommands.addCommands(
      `aws s3 cp s3://${asset.s3BucketName}/${asset.s3ObjectKey} /tmp/scripts.zip >> /var/tmp/setup`,
      `unzip -d /var/lib/scripts /tmp/scripts.zip >>/var/tmp/setup`,
      `bash /var/lib/scripts/user-data.sh ${props.serverName} ${props.volumeSize} ${props.snapshotGen}`
    );

    const multipartUserData = new ec2.MultipartUserData();
    // Execute the rest of setup
    multipartUserData.addPart(ec2.MultipartBody.fromUserData(setupCommands));

    const launchTemplateName = `${this.stackName}Template`;
    const template = new ec2.LaunchTemplate(this, "template", {
      userData: multipartUserData,
      keyName: props.base.keyPairName,
      machineImage: ec2.MachineImage.fromSsmParameter(
        "/aws/service/ami-amazon-linux-latest/al2022-ami-kernel-default-x86_64"
      ),
      launchTemplateName: launchTemplateName,
      securityGroup: props.base.securityGroup,
      role: props.base.ec2role,
    });

    const cfnSpotFleet = new ec2.CfnSpotFleet(this, "soptFleet", {
      spotFleetRequestConfigData: {
        iamFleetRole: props.base.fleetSpotRoleArn,
        allocationStrategy: "lowestPrice",
        terminateInstancesWithExpiration: false,
        targetCapacity: 0,
        type: "maintain",
        targetCapacityUnitType: "units",
        onDemandAllocationStrategy: "lowestPrice",
        launchTemplateConfigs: [
          {
            launchTemplateSpecification: {
              launchTemplateId: getString(template.launchTemplateId, ``),
              version: template.latestVersionNumber,
            },
            overrides: [
              {
                subnetId: props.base.subnets.join(","),
                instanceRequirements: {
                  vCpuCount: {
                    max: 4,
                    min: 2,
                  },
                  memoryMiB: {
                    min: 7168,
                    max: 16384,
                  },
                },
              },
            ],
          },
        ],
      },
    });
    Tags.of(cfnSpotFleet).add("Name", `${this.stackName}-sfr`);
    Tags.of(cfnSpotFleet).add("StackName", this.stackName);

    /*
    new CfnOutput(this, "keyPairName", { value: keyPair.keyName });
    new CfnOutput(this, "roleARN", { value: ec2role.roleArn });
    new CfnOutput(this, "SecurityGroupID", { value: mySG.securityGroupId });
    */
    new CfnOutput(this, "LaunchTemplateID", {
      value: getString(template.launchTemplateId, ``),
    });
    new CfnOutput(this, "LaunchTemplateVersion", {
      value: template.versionNumber,
    });
    new CfnOutput(this, "cfnSpotFleetID", {
      value: cfnSpotFleet.attrId,
    });
  }
}
