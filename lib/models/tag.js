'use strict'
// external modules
var Sequelize = require('sequelize')

module.exports = function (sequelize, DataTypes) {
  var Tag = sequelize.define('Tag', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
  }, {
    paranoid: true,
    // 设置表注释
    comment: '标签表',
  })

  Tag.associate = function (models) {
    Tag.belongsTo(models.User, {
      foreignKey: 'ownerId',
      as: 'owner',
      constraints: false
    })
  }
  return Tag
}
