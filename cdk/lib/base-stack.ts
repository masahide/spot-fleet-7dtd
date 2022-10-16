import * as cdk from "aws-cdk-lib";
import {
  aws_iam as iam,
  aws_ec2 as ec2,
  Tags,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";
// import { readFileSync } from "fs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface spot7dtdBaseprops extends StackProps {
  myIP: string;
  sshPublicKey: string;
}

export interface spot7dtdBase {
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
  ec2role: iam.Role;
  fleetSpotRoleArn: string;
  keyPairName: string;
  subnets: string[];
}

export class spot7dtdBaseStack extends cdk.Stack {
  public readonly base: spot7dtdBase;

  constructor(scope: Construct, id: string, props: spot7dtdBaseprops) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, "vpc", {
      //cidr: "10.1.0.0/21",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
      maxAzs: 99,
    });

    // SecurityGroup
    const securityGroup = new ec2.SecurityGroup(this, "SG", {
      vpc,
      description: "Allow ssh access to ec2 instances",
      allowAllOutbound: true, // Can be set to false
    });
    securityGroup.addIngressRule(
      ec2.Peer.ipv4(props.myIP),
      ec2.Port.tcp(22),
      "ssh access from home"
    );
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.udpRange(26900, 26902),
      "7dtd port"
    );
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcpRange(26900, 26902),
      "7dtd port"
    );
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(28082),
      "LinuxGSM"
    );
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.allIcmp(),
      "icmp"
    );
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "http");
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "https"
    );
    Tags.of(securityGroup).add("Name", `${this.stackName}SG`);

    // IAM policy
    const policy = new iam.ManagedPolicy(this, "EC2Policy", {
      description: "",
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "kms:Decrypt",
            "sqs:ReceiveMessage",
            "sqs:SendMessage",
            "sqs:DeleteMessage",
            "sqs:ChangeMessageVisibility",
            "dynamodb:PutItem",
            "dynamodb:GetItem",
            "dynamodb:DeleteItem",
            "dynamodb:UpdateItem",
            "route53:ChangeResourceRecordSets",
            "ssm:GetParametersByPath",
            "ssm:GetParameters",
            "ssm:GetParameter",
          ],
          resources: [
            "arn:aws:sqs:*:*:DiscordBotStack-Queue*",
            "arn:aws:kms:*:*:key/CMK",
            "arn:aws:ssm:*:*:parameter/*",
            "arn:aws:dynamodb:*:*:table/DiscordBotStack-Table*",
            "arn:aws:route53:::hostedzone/*",
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "ec2:DescribeVolumes",
            "ec2:DescribeSnapshots",
            "ec2:DeleteSnapshot",
            "ec2:CreateSnapshot",
            "ec2:DetachVolume",
            "ec2:AttachVolume",
            "ec2:DeleteVolume",
            "ec2:CreateVolume",
            "ec2:CreateTags",
          ],
          resources: ["*"],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["ec2:DisassociateAddress", "ec2:AssociateAddress"],
          resources: ["*"],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["ec2:ModifySpotFleetRequest"],
          resources: [
            "arn:aws:ec2:*::spot-fleet-request/*",
            "arn:aws:ec2:*::subnet/*",
            "arn:aws:ec2:*::launch-template/*",
          ],
        }),
      ],
    });
    // IAM rule
    const fleetSpotRole = new iam.Role(this, "spotfleetRole", {
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonEC2SpotFleetTaggingRole"
        ),
      ],
      assumedBy: new iam.ServicePrincipal("spotfleet.amazonaws.com"),
      path: "/",
    });
    // IAM rule
    const ec2role = new iam.Role(this, "EC2Role", {
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ReadOnlyAccess"),
        policy,
      ],
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      path: "/",
    });

    // ssh key pair
    const keyPair = new ec2.CfnKeyPair(this, "MyCfnKeyPair", {
      keyName: `${this.stackName}KeyPair`,
      publicKeyMaterial: props.sshPublicKey,
    });

    this.base = {
      vpc: vpc,
      securityGroup: securityGroup,
      ec2role: ec2role,
      fleetSpotRoleArn: fleetSpotRole.roleArn,
      keyPairName: keyPair.keyName,
      subnets: vpc.publicSubnets.map((d): string => {
        return d.subnetId;
      }),
    };
  }
}
