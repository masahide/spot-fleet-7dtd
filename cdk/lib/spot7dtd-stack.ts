import * as cdk from "aws-cdk-lib";
import { StackProps } from "aws-cdk-lib";
import { Asset } from "aws-cdk-lib/aws-s3-assets";
import { CfnOutput, aws_ec2 as ec2, aws_ssm as ssm } from "aws-cdk-lib";
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

    const asset = new Asset(this, "Asset", { path: "../files" });
    ////
    const setupCommands = ec2.UserData.forLinux();
    setupCommands.addCommands(
      `aws s3 cp s3://${asset.s3BucketName}/${asset.s3ObjectKey} /tmp/files.zip >> /var/tmp/setup`,
      `unzip -d /var/lib/ /tmp/files.zip >>/var/tmp/setup`,
      `bash /var/lib/scripts/user-data.sh ${this.stackName} ${props.serverName} ${props.volumeSize} ${props.snapshotGen}`
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

    const param = new ssm.StringParameter(this, "Parameter", {
      allowedPattern: ".*",
      description: "spot-fleet request ID",
      parameterName: `/${this.stackName}/${props.serverName}/sfr-id`,
      stringValue: cfnSpotFleet.attrId,
      tier: ssm.ParameterTier.STANDARD,
    });

    new CfnOutput(this, "cfnSpotFleetID", {
      value: cfnSpotFleet.attrId,
    });
    new CfnOutput(this, "ssmParameterName", {
      value: param.parameterName,
    });
  }
}
