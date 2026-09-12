import { describe, expect, it } from "vitest";
import { lanDevOrigins, stripIpv6ZoneId } from "./dev-origins";

describe("stripIpv6ZoneId", () => {
  it("removes a scoped zone id", () => {
    expect(stripIpv6ZoneId("fe80::1%wlan0")).toBe("fe80::1");
  });

  it("leaves unscoped addresses unchanged", () => {
    expect(stripIpv6ZoneId("192.168.1.212")).toBe("192.168.1.212");
    expect(stripIpv6ZoneId("fe80::1")).toBe("fe80::1");
  });
});

describe("lanDevOrigins", () => {
  it("includes non-internal IPv4 NICs and skips loopback", () => {
    expect(
      lanDevOrigins({
        extra: "",
        interfaces: {
          lo: [
            {
              address: "127.0.0.1",
              netmask: "255.0.0.0",
              family: "IPv4",
              mac: "00:00:00:00:00:00",
              internal: true,
              cidr: "127.0.0.1/8",
            },
          ],
          eth0: [
            {
              address: "192.168.1.212",
              netmask: "255.255.255.0",
              family: "IPv4",
              mac: "aa:bb:cc:dd:ee:ff",
              internal: false,
              cidr: "192.168.1.212/24",
            },
          ],
        },
      }),
    ).toEqual(["192.168.1.212"]);
  });

  it("strips IPv6 zone ids from NIC addresses", () => {
    expect(
      lanDevOrigins({
        extra: "",
        interfaces: {
          wlan0: [
            {
              address: "fe80::1%wlan0",
              netmask: "ffff:ffff:ffff:ffff::",
              family: "IPv6",
              mac: "aa:bb:cc:dd:ee:ff",
              internal: false,
              cidr: "fe80::1%wlan0/64",
              scopeid: 2,
            },
          ],
        },
      }),
    ).toEqual(["fe80::1"]);
  });

  it("merges comma-separated extra hosts from env-style input", () => {
    expect(
      lanDevOrigins({
        extra: " tunnel.example.com , *.tunnel.example.com ",
        interfaces: {
          eth0: [
            {
              address: "192.168.1.212",
              netmask: "255.255.255.0",
              family: "IPv4",
              mac: "aa:bb:cc:dd:ee:ff",
              internal: false,
              cidr: "192.168.1.212/24",
            },
          ],
        },
      }),
    ).toEqual(["192.168.1.212", "tunnel.example.com", "*.tunnel.example.com"]);
  });
});
